import { createServiceClient, getSessionUser } from "@/lib/supabase/server";

const EMBED_MODEL = "nvidia/nv-embedqa-e5-v5"; // NVIDIA embedding model
const RERANK_MODEL = "nvidia/nv-rerankqa-mistral-4b"; // NVIDIA reranker
const LLM_MODEL = "nvidia/nemotron-3-ultra"; // NVIDIA LLM (or Anthropic fallback)
const TOP_K_EMBEDDING = 20; // candidates from vector search
const TOP_K_RERANK = 8; // after rerank
const MAX_EVIDENCE = 5; // citations sent to LLM

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

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

async function nvidiaComplete(messages: Array<{ role: string; content: string }>): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY not set");

  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 2048,
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA complete failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content ?? "";
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
  supabase: ReturnType<typeof createServiceClient>,
  query: string,
  filters: { type?: string; status?: string; tag?: string; dateFrom?: string; dateTo?: string } = {}
): Promise<EvidenceChunk[]> {
  // 1. Embed the query
  const [queryEmbedding] = await nvidiaEmbed([query]);

  // 2. Resolve filter -> item IDs (exact match on metadata)
  let itemIds: string[] | null = null;
  if (filters.type || filters.status || filters.tag || filters.dateFrom || filters.dateTo) {
    let q = supabase.from("knowledge_items").select("id").limit(1000);
    if (filters.type) q = q.eq("type", filters.type);
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.tag) q = q.contains("tags", [filters.tag]);
    if (filters.dateFrom) q = q.gte("updated_at", filters.dateFrom);
    if (filters.dateTo) q = q.lte("updated_at", filters.dateTo);
    const { data } = await q;
    itemIds = (data ?? []).map((r) => r.id as string);
    if (itemIds.length === 0) return [];
  }

  // 3. Semantic search via RPC
  const { data: semantic, error: semErr } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: queryEmbedding,
    match_count: TOP_K_EMBEDDING,
    filter_item_ids: itemIds,
  });

  if (semErr) throw new Error(`Semantic search failed: ${semErr.message}`);

  const candidates: EvidenceChunk[] = (semantic ?? []).map((r: any) => ({
    id: r.id,
    knowledge_item_id: r.knowledge_item_id,
    chunk_index: r.chunk_index,
    heading: r.heading,
    text: r.text,
    start_offset: r.start_offset,
    end_offset: r.end_offset,
    similarity: r.similarity,
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

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
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

  // Create or get session
  let sessionIdFinal = sessionId;
  if (!sessionIdFinal) {
    const { data: session, error } = await supabase
      .from("chat_sessions")
      .insert({ user_email: user.email!, title: message.slice(0, 60) })
      .select("id")
      .single();
    if (error) throw new Error(`Session create failed: ${error.message}`);
    sessionIdFinal = session.id;
  }

  // Store user message
  await supabase.from("chat_messages").insert({
    session_id: sessionIdFinal,
    role: "user",
    content: message,
    filters,
  });

  // Retrieve evidence
  const evidence = await retrieveEvidence(supabase, message, filters);

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
  const { data: assistantMsg } = await supabase
    .from("chat_messages")
    .insert({
      session_id: sessionIdFinal,
      role: "assistant",
      content: answer,
      evidence: storedEvidence,
    })
    .select("id, created_at")
    .single();

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
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", messageId: assistantMsg?.id })}\n\n`));
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