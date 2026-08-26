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
  // Stable identifier of the underlying knowledge item. Used by the client to
  // build a defensive deep link and to fall back gracefully if a result's
  // resource disappears.
  sourceId?: string
}

interface SourceGroup {
  source: string
  label: string
  results: RetrievalResult[]
  matchCount: number
}

// Pulls the most relevant slice of `text` around the first meaningful match
// for `query`, keeping a small surrounding context window. This keeps search
// results focused on the exact line/term that matched instead of dumping the
// entire surrounding document.
const EXCERPT_CONTEXT = 140;

function buildExcerpt(text: string, query: string): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  const q = (query || "").trim();
  if (!clean) return "";
  if (!q) return clean.slice(0, EXCERPT_CONTEXT * 2);

  const lower = clean.toLowerCase();
  const needles = [
    q.toLowerCase(),
    ...q
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3),
  ];

  let hit = -1;
  for (const needle of needles) {
    const idx = lower.indexOf(needle);
    if (idx !== -1 && (hit === -1 || idx < hit)) hit = idx;
  }
  if (hit === -1) return clean.slice(0, EXCERPT_CONTEXT * 2);

  const start = Math.max(0, hit - EXCERPT_CONTEXT);
  const end = Math.min(clean.length, hit + needles[0].length + EXCERPT_CONTEXT);
  const prefix = start > 0 ? "… " : "";
  const suffix = end < clean.length ? " …" : "";
  return prefix + clean.slice(start, end) + suffix;
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
    // Resolve the parent knowledge item slugs so result deep links point at
    // the real /knowledge/[slug] route (not the internal $id, which would 404).
    const itemIds = [...new Set(res.documents.map((row) => row.knowledge_item_id))];
    const itemsRes = await databases.listDocuments(DB, ITEMS, [
      Query.equal("$id", itemIds),
      Query.limit(1000),
    ]);
    const slugById = new Map<string, string>(
      itemsRes.documents.map((item) => [item.$id, item.slug])
    );

    return res.documents.map((row) => {
      const slug = slugById.get(row.knowledge_item_id) || row.knowledge_item_id;
      return {
        source: "knowledge",
        title: row.heading || "Knowledge",
        snippet: buildExcerpt(row.text, query),
        sourceId: row.knowledge_item_id,
        path: `/knowledge/${slug}?chunk=${row.chunk_index}`,
        score: 0,
      } as RetrievalResult;
    });
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
      const slug = row.slug || row.$id;
      map.set(row.$id, {
        source: "knowledge",
        title: row.title || "Knowledge",
        snippet: buildExcerpt((row.body || "").slice(0, 4000), query),
        sourceId: row.$id,
        path: `/knowledge/${slug}`,
        score: 0,
      } as RetrievalResult);
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
