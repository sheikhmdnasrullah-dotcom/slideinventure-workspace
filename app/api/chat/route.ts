import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { nvidiaComplete } from "@/lib/llm/nvidia";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const SESSIONS = APPWRITE.collections.chatSessions;
const MESSAGES = APPWRITE.collections.chatMessages;
const CHUNKS = APPWRITE.collections.knowledgeChunks;

const EMBED_MODEL = "nvidia/nv-embedqa-e5-v5"; // NVIDIA embedding model
const RERANK_MODEL = "nvidia/nv-rerankqa-mistral-4b"; // NVIDIA reranker
const LLM_MODEL = "nvidia/nemotron-3-ultra-550b-a55b"; // NVIDIA LLM (or Anthropic fallback)
const TOP_K_EMBEDDING = 20; // candidates from vector search
const TOP_K_RERANK = 8; // after rerank
const MAX_EVIDENCE = 5; // citations sent to LLM

async function nvidiaEmbed(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY not set");

  const res = await fetch("https://integrate.api.nvidia.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts,
      input_type: "query",
      encoding_format: "float",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA embed failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.data.map((d: any) => d.embedding);
}

async function nvidiaRerank(query: string, passages: string[]): Promise<number[]> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return passages.map((_, i) => i); // fallback: no rerank

  const res = await fetch("https://integrate.api.nvidia.com/v1/rerank", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: RERANK_MODEL,
      query,
      passages,
      top_n: Math.min(TOP_K_RERANK, passages.length),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn(`NVIDIA rerank failed: ${res.status} ${err}`);
    return passages.map((_, i) => i);
  }

  const data = await res.json();
  return data.data.map((d: any) => d.index);
}

interface EvidenceChunk {
  id: string;
  knowledge_item_id: string;
  chunk_index: number;
  heading: string | null;
  text: string;
  start_offset: number;
  end_offset: number;
  similarity: number;
}

async function retrieveEvidence(
  query: string,
  filters: { type?: string; status?: string; tag?: string; dateFrom?: string; dateTo?: string } = {}
): Promise<EvidenceChunk[]> {
  // 1. Embed the query — keep the NVIDIA external call for parity, but Appwrite
  //    has no vector store, so the embedding is not used for matching.
  await nvidiaEmbed([query]).catch(() => null);

  // 2. Resolve filter -> item $ids (exact match on metadata)
  let itemIds: string[] | null = null;
  if (filters.type || filters.status || filters.tag || filters.dateFrom || filters.dateTo) {
    const queries: string[] = [];
    if (filters.type) queries.push(Query.equal("type", filters.type));
    if (filters.status) queries.push(Query.equal("status", filters.status));
    if (filters.tag) queries.push(Query.contains("tags", filters.tag));
    if (filters.dateFrom) queries.push(Query.greaterThanEqual("updated_at", filters.dateFrom));
    if (filters.dateTo) queries.push(Query.lessThanEqual("updated_at", filters.dateTo));
    queries.push(Query.limit(1000));
    const { documents } = await databases.listDocuments(
      DB,
      APPWRITE.collections.knowledgeItems,
      queries
    );
    itemIds = documents.map((d) => d.$id);
    if (itemIds.length === 0) return [];
  }

  // 3. Fulltext search over chunks (replaces the vector RPC)
  const queries: string[] = [Query.search("text", query), Query.limit(TOP_K_EMBEDDING)];
  if (itemIds) queries.push(Query.equal("knowledge_item_id", itemIds));

  const { documents } = await databases.listDocuments(DB, CHUNKS, queries);

  const candidates: EvidenceChunk[] = documents.map((r: any) => ({
    id: r.$id,
    knowledge_item_id: r.knowledge_item_id,
    chunk_index: r.chunk_index,
    heading: r.heading ?? null,
    text: r.text,
    start_offset: r.start_offset,
    end_offset: r.end_offset,
    similarity: 1.0,
  }));

  if (candidates.length === 0) return [];

  // 4. Rerank with NVIDIA reranker
  const passages = candidates.map((c) => c.text);
  const rerankedIndices = await nvidiaRerank(query, passages);

  const reranked = rerankedIndices
    .map((idx) => candidates[idx])
    .slice(0, TOP_K_RERANK);

  return reranked;
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json();

  const {
    sessionId,
    message,
    filters = {},
    model = LLM_MODEL,
  } = body as {
    sessionId?: string;
    message: string;
    filters?: { type?: string; status?: string; tag?: string; dateFrom?: string; dateTo?: string };
    model?: string;
  };

  if (!message?.trim()) {
    return Response.json({ error: "Message required" }, { status: 400 });
  }

  // Create or get session (ownership-scoped to the current user)
  let sessionIdFinal = sessionId;
  if (!sessionIdFinal) {
    const session = await databases.createDocument(DB, SESSIONS, ID.unique(), {
      user_email: user.email!,
      title: message.slice(0, 60),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    sessionIdFinal = session.$id;
  } else {
    const owned = await databases.listDocuments(DB, SESSIONS, [
      Query.equal("$id", sessionIdFinal),
      Query.equal("user_email", user.email!),
      Query.limit(1),
    ]);
    if (owned.documents.length === 0) {
      const session = await databases.createDocument(DB, SESSIONS, ID.unique(), {
        user_email: user.email!,
        title: message.slice(0, 60),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      sessionIdFinal = session.$id;
    }
  }

  // Store user message
  await databases.createDocument(DB, MESSAGES, ID.unique(), {
    session_id: sessionIdFinal,
    role: "user",
    content: message,
    filters: JSON.stringify(filters),
    created_at: new Date().toISOString(),
  });

  // Retrieve evidence
  const evidence = await retrieveEvidence(message, filters);

  // Build context for LLM
  const contextParts = evidence.map((e, i) => {
    const header = e.heading ? `${e.heading}\n` : "";
    return `[${i + 1}] ${header}${e.text}`;
  });
  const context = contextParts.join("\n\n---\n\n");

  const systemPrompt = `You are the SlideIn Venture OS assistant. Answer using ONLY the provided evidence. 
If the evidence is insufficient, say "I couldn't find enough evidence in the knowledge base."
Cite evidence by number [1], [2], etc. Do not hallucinate.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Question: ${message}\n\nEvidence:\n${context}` },
  ];

  // Get LLM answer
  const answer = await nvidiaComplete(messages);

  // Prepare evidence for storage (only top MAX_EVIDENCE)
  const storedEvidence = evidence.slice(0, MAX_EVIDENCE).map((e) => ({
    chunk_id: e.id,
    knowledge_item_id: e.knowledge_item_id,
    chunk_index: e.chunk_index,
    heading: e.heading,
    text: e.text,
    start_offset: e.start_offset,
    end_offset: e.end_offset,
    similarity: e.similarity,
  }));

  // Store assistant message with evidence
  const assistantMsg = await databases.createDocument(DB, MESSAGES, ID.unique(), {
    session_id: sessionIdFinal,
    role: "assistant",
    content: answer,
    evidence: JSON.stringify(storedEvidence),
    filters: "{}",
    created_at: new Date().toISOString(),
  });

  // Stream response as SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send session ID first
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "session", sessionId: sessionIdFinal })}\n\n`));

      // Stream answer in chunks (simulated streaming since NVIDIA non-streaming)
      const words = answer.split(" ");
      for (let i = 0; i < words.length; i += 3) {
        const chunk = words.slice(i, i + 3).join(" ") + (i + 3 < words.length ? " " : "");
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", content: chunk })}\n\n`));
      }

      // Send evidence
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "evidence", evidence: storedEvidence })}\n\n`));

      // Done
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", messageId: assistantMsg.$id })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
