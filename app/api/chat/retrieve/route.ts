import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const CHUNKS = APPWRITE.collections.knowledgeChunks;
const ITEMS = APPWRITE.collections.knowledgeItems;

interface RetrievalResult {
  source: string
  title: string
  snippet: string
  path?: string
  url?: string
  score: number
}

interface SourceGroup {
  source: string
  label: string
  results: RetrievalResult[]
  matchCount: number
}

async function searchKnowledgeChunks(query: string): Promise<RetrievalResult[]> {
  if (!query.trim()) return [];

  // Preferred: fulltext search over chunked knowledge (replaces
  // match_knowledge_chunks_fts; Appwrite has no tsvector/SQL).
  const res = await databases.listDocuments(DB, CHUNKS, [
    Query.search("text", query),
    Query.limit(5),
  ]);

  if (res.documents.length > 0) {
    return res.documents.map((row: any) => ({
      source: "knowledge",
      title: row.heading || "Knowledge",
      snippet: row.text,
      path: `/knowledge/${row.knowledge_item_id}?chunk=${row.chunk_index}`,
      score: 0,
    }));
  }

  // Fallback: plain keyword search across knowledge items so the chat still
  // finds terminal codes, passwords, and notes stored as text.
  const [titleRes, bodyRes] = await Promise.all([
    databases.listDocuments(DB, ITEMS, [Query.search("title", query), Query.limit(5)]),
    databases.listDocuments(DB, ITEMS, [Query.search("body", query), Query.limit(5)]),
  ]);
  const map = new Map<string, RetrievalResult>();
  for (const row of [...titleRes.documents, ...bodyRes.documents]) {
    if (!map.has(row.$id)) {
      map.set(row.$id, {
        source: "knowledge",
        title: (row as any).title || "Knowledge",
        snippet: ((row as any).body || "").slice(0, 300),
        path: `/knowledge/${row.$id}`,
        score: 0,
      });
    }
  }
  return [...map.values()];
}

// TODO(appwrite): leads / terminal / apps / useful_links retrieval was backed
// by Supabase FTS RPCs (search_leads_fts, search_terminal_commands_fts,
// search_apps_fts, search_useful_links_fts). Those collections are owned by
// other migration agents and are out of scope for the Knowledge/Chat module
// migration. Reimplement here once their Appwrite fulltext indexes exist.
async function searchExternal(_source: string, _query: string): Promise<RetrievalResult[]> {
  return [];
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const message = (body.message as string | undefined)?.trim();
  if (!message) {
    return Response.json({ error: "Message required" }, { status: 400 });
  }

  const start = Date.now();

  const [knowledge, leads, terminal, apps, links] = await Promise.all([
    searchKnowledgeChunks(message),
    searchExternal("leads", message),
    searchExternal("terminal", message),
    searchExternal("apps", message),
    searchExternal("useful_links", message),
  ]);

  const sources: SourceGroup[] = [
    { source: "knowledge", label: "Knowledge base", results: knowledge, matchCount: knowledge.length },
    { source: "leads", label: "Leads", results: leads, matchCount: leads.length },
    { source: "terminal", label: "Terminal history", results: terminal, matchCount: terminal.length },
    { source: "apps", label: "Apps", results: apps, matchCount: apps.length },
    { source: "links", label: "Useful links", results: links, matchCount: links.length },
  ];

  const elapsed = Date.now() - start;

  return Response.json({
    type: "retrieval",
    query: message,
    elapsedMs: elapsed,
    sources,
  });
}
