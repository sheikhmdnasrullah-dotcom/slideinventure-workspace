import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { searchVector } from "@/lib/retrieval/vector-index";
import { tavilySearch } from "@/lib/search/tavily";
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

// Cross-section retrieval. Terminal + useful_links use the LanceDB semantic
// index; leads + apps use Appwrite fulltext. Every path is best-effort and
// degrades to [] so the chat never hard-fails on a missing index.
async function searchExternal(source: string, query: string): Promise<RetrievalResult[]> {
  if (!query.trim()) return [];
  try {
    if (source === "terminal") {
      const hits = await searchVector(query, { collections: ["terminal"], limit: 5 });
      if (hits.length) {
        return hits.map((h) => ({
          source: "terminal",
          title: "Terminal command",
          snippet: buildExcerpt(h.text, query),
          sourceId: h.docId,
          path: "/terminal",
          score: h.score,
        }));
      }
      const res = await databases.listDocuments(DB, APPWRITE.collections.terminalCommands, [
        Query.search("command", query),
        Query.limit(5),
      ]);
      return res.documents.map((row: any) => ({
        source: "terminal",
        title: row.title || row.command || "Terminal command",
        snippet: buildExcerpt(`${row.command || ""} ${row.description || ""}`, query),
        sourceId: row.$id,
        path: "/terminal",
        score: 0,
      }));
    }

    if (source === "links") {
      const hits = await searchVector(query, { collections: ["links"], limit: 5 });
      if (hits.length) {
        return hits.map((h) => ({
          source: "links",
          title: "Useful link",
          snippet: buildExcerpt(h.text, query),
          sourceId: h.docId,
          path: "/useful-links",
          score: h.score,
        }));
      }
      const res = await databases.listDocuments(DB, APPWRITE.collections.usefulLinks, [
        Query.search("title", query),
        Query.limit(5),
      ]);
      return res.documents.map((row: any) => ({
        source: "links",
        title: row.title || "Link",
        snippet: buildExcerpt(`${row.title || ""} ${row.url || ""} ${row.description || ""}`, query),
        sourceId: row.$id,
        path: "/useful-links",
        score: 0,
      }));
    }

    if (source === "leads") {
      const [byCompany, byEmail] = await Promise.all([
        databases.listDocuments(DB, APPWRITE.collections.leads, [Query.search("company", query), Query.limit(5)]),
        databases.listDocuments(DB, APPWRITE.collections.leads, [Query.search("email", query), Query.limit(5)]),
      ]);
      const map = new Map<string, RetrievalResult>();
      for (const row of [...byCompany.documents, ...byEmail.documents]) {
        if (!map.has(row.$id)) {
          map.set(row.$id, {
            source: "leads",
            title: `${row.first_name || ""} ${row.last_name || ""}`.trim() || row.company || "Lead",
            snippet: buildExcerpt(`${row.company || ""} ${row.email || ""}`, query),
            sourceId: row.$id,
            path: "/leads",
            score: 0,
          });
        }
      }
      return [...map.values()];
    }

    if (source === "apps") {
      const res = await databases.listDocuments(DB, APPWRITE.collections.apps, [
        Query.search("name", query),
        Query.limit(5),
      ]);
      return res.documents.map((row: any) => ({
        source: "apps",
        title: row.name || "App",
        snippet: buildExcerpt(`${row.name || ""} ${row.description || ""}`, query),
        sourceId: row.$id,
        path: "/apps",
        score: 0,
      }));
    }
  } catch (err) {
    console.warn(`searchExternal(${source}) failed (non-fatal):`, err);
  }
  return [];
}

// Web search (Tavily). Best-effort: degrades to [] so the chat never hard-fails
// when the key is missing or the network is down. Surfaced as its own source
// group so users can see and open real web results.
async function searchWeb(query: string): Promise<RetrievalResult[]> {
  if (!query.trim()) return [];
  try {
    const hits = await tavilySearch(query, { maxResults: 5 });
    return hits.map((h) => ({
      source: "web",
      title: h.title || h.url,
      snippet: buildExcerpt(h.content, query),
      url: h.url,
      score: h.score,
    }));
  } catch (err) {
    console.warn("searchWeb failed (non-fatal):", err);
    return [];
  }
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

  const [knowledge, leads, terminal, apps, links, web] = await Promise.all([
    searchKnowledgeChunks(message),
    searchExternal("leads", message),
    searchExternal("terminal", message),
    searchExternal("apps", message),
    searchExternal("useful_links", message),
    searchWeb(message),
  ]);

  const sources: SourceGroup[] = [
    { source: "knowledge", label: "Knowledge base", results: knowledge, matchCount: knowledge.length },
    { source: "leads", label: "Leads", results: leads, matchCount: leads.length },
    { source: "terminal", label: "Terminal history", results: terminal, matchCount: terminal.length },
    { source: "apps", label: "Apps", results: apps, matchCount: apps.length },
    { source: "links", label: "Useful links", results: links, matchCount: links.length },
    { source: "web", label: "Web search", results: web, matchCount: web.length },
  ];

  const elapsed = Date.now() - start;

  return Response.json({
    type: "retrieval",
    query: message,
    elapsedMs: elapsed,
    sources,
  });
}
