import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { NextRequest } from "next/server";
import { rerank } from "@/lib/knowledge/nvidia";
import { searchVector } from "@/lib/retrieval/vector-index";

const DB = APPWRITE.databaseId;
const CHUNKS = APPWRITE.collections.knowledgeChunks;
const ITEMS = APPWRITE.collections.knowledgeItems;
const HISTORY = APPWRITE.collections.knowledgeSearchHistory;

const PAGE_SIZE = 50;
const MAX_CANDIDATES = 200;
const SEMANTIC_MATCH_COUNT = 50;
const HYBRID_FUSE_COUNT = 20;
const RRF_K = 60;

type ChunkHit = {
  id: string;
  knowledge_item_id: string;
  chunk_index: number;
  heading: string | null;
  text: string;
  start_offset: number;
  end_offset: number;
  similarity?: number;
  knowledge_items?: unknown;
};

type ItemHit = {
  id: string;
  slug: string;
  type: string;
  title: string;
  status: string;
  source: string | null;
  updated_at: string;
  body: string | null;
  document_id: string | null;
};

type Filters = {
  type: string | null;
  status: string | null;
  tag: string | null;
  dateFrom: string | null;
  dateTo: string | null;
};

function readFilters(searchParams: URLSearchParams): Filters {
  return {
    type: searchParams.get("type"),
    status: searchParams.get("status"),
    tag: searchParams.get("tag"),
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
  };
}

function hasFilters(filters: Filters): boolean {
  return Object.values(filters).some((v) => v);
}

function filterQueries(filters: Filters): string[] {
  const q: string[] = [];
  if (filters.type) q.push(Query.equal("type", filters.type));
  if (filters.status) q.push(Query.equal("status", filters.status));
  if (filters.tag) q.push(Query.contains("tags", filters.tag));
  if (filters.dateFrom) q.push(Query.greaterThanEqual("updated_at", filters.dateFrom));
  if (filters.dateTo) q.push(Query.lessThanEqual("updated_at", filters.dateTo));
  return q;
}

// Resolves type/status/tag/date filters to a list of matching knowledge_item
// $ids, so chunk queries can narrow with a single .equal(). Returns null when
// no filters are set (meaning: don't narrow).
async function resolveFilteredItemIds(filters: Filters): Promise<string[] | null> {
  if (!hasFilters(filters)) return null;
  const res = await databases.listDocuments(DB, ITEMS, [
    ...filterQueries(filters),
    Query.limit(1000),
  ]);
  return res.documents.map((d) => d.$id);
}

async function recordSearchHistory(
  userEmail: string,
  query: string,
  mode: string,
  resultCount: number
) {
  if (!query) return;
  try {
    await databases.createDocument(DB, HISTORY, ID.unique(), {
      user_email: userEmail,
      query,
      mode,
      result_count: resultCount,
      created_at: new Date().toISOString(),
    });
  } catch {
    // history is a convenience feature, not load-bearing. Don't fail the search over it
  }
}

function serializeChunk(doc: Record<string, any>): ChunkHit {
  return {
    id: doc.$id,
    knowledge_item_id: doc.knowledge_item_id,
    chunk_index: doc.chunk_index,
    heading: doc.heading ?? null,
    text: doc.text,
    start_offset: doc.start_offset,
    end_offset: doc.end_offset,
  };
}

// Attaches parent knowledge_items to chunk hits, giving every mode the same
// shape lexical hits already had: one results component for every mode.
async function attachItems(rows: ChunkHit[]): Promise<ChunkHit[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => r.knowledge_item_id))];
  const res = await databases.listDocuments(DB, ITEMS, [
    Query.equal("$id", ids),
    Query.limit(1000),
  ]);
  const byId = new Map(
    res.documents.map((item) => [
      item.$id,
      {
        slug: item.slug,
        title: item.title,
        type: item.type,
        source: item.source ?? null,
        status: item.status,
        updated_at: item.updated_at,
        document_id: item.document_id ?? null,
      },
    ])
  );
  return rows.map((row) => ({ ...row, knowledge_items: byId.get(row.knowledge_item_id) ?? null }));
}

async function lexicalSearch(
  query: string,
  filters: Filters,
  offset: number,
  limit: number
): Promise<{ total: number; results: ChunkHit[] }> {
  const itemIds = await resolveFilteredItemIds(filters);
  if (itemIds !== null && itemIds.length === 0) {
    return { total: 0, results: [] };
  }

  const queries: string[] = [Query.search("text", query), Query.limit(limit), Query.offset(offset)];
  if (itemIds) queries.push(Query.equal("knowledge_item_id", itemIds));

  const res = await databases.listDocuments(DB, CHUNKS, queries);
  const results = res.documents.map(serializeChunk);
  return { total: res.total, results: await attachItems(results) };
}

async function searchExact(query: string, page: number, filters: Filters) {
  const offset = (page - 1) * PAGE_SIZE;
  const limit = Math.min(PAGE_SIZE, MAX_CANDIDATES - offset);
  if (limit <= 0) return { total: 0, results: [] as ChunkHit[] };
  return lexicalSearch(query, filters, offset, limit);
}

// Reciprocal rank fusion: chunks ranked highly by either lexical or semantic
// search float up, without needing to normalize/compare their different
// score scales directly.
function fuseByRank(lexical: ChunkHit[], semantic: ChunkHit[], take: number): ChunkHit[] {
  const scores = new Map<string, { hit: ChunkHit; score: number }>();
  const add = (hits: ChunkHit[]) => {
    hits.forEach((hit, rank) => {
      const contribution = 1 / (RRF_K + rank + 1);
      const existing = scores.get(hit.id);
      if (existing) existing.score += contribution;
      else scores.set(hit.id, { hit, score: contribution });
    });
  };
  add(lexical);
  add(semantic);

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, take)
    .map((entry) => entry.hit);
}

// Real vector search via the shared LanceDB index (lib/retrieval/vector-index.ts),
// keyed one row per knowledge_item (embedded from its full body at write time,
// see reindexChunks). Falls back to searchExact upstream when this returns
// no hits (no NVIDIA_API_KEY, or nothing indexed yet).
async function searchSemantic(
  query: string,
  filters: Filters,
  matchCount: number
): Promise<ChunkHit[]> {
  const itemIds = await resolveFilteredItemIds(filters);
  if (itemIds !== null && itemIds.length === 0) return [];

  const vectorHits = await searchVector(query, { collections: ["knowledge"], limit: matchCount });
  const allowed = itemIds ? new Set(itemIds) : null;
  const scoped = allowed ? vectorHits.filter((h) => allowed.has(h.docId)) : vectorHits;
  if (scoped.length === 0) return [];

  const hits: ChunkHit[] = scoped.map((h) => ({
    id: `vec-${h.docId}`,
    knowledge_item_id: h.docId,
    chunk_index: 0,
    heading: null,
    text: h.text,
    start_offset: 0,
    end_offset: h.text.length,
    // LanceDB's _distance is smaller-is-better (cosine distance); map to a
    // 0-1 "higher is better" similarity for parity with the old fixed value.
    similarity: 1 / (1 + Math.max(h.score, 0)),
  }));
  return attachItems(hits);
}

async function searchHybrid(
  query: string,
  page: number,
  filters: Filters
): Promise<{ total: number; results: ChunkHit[] }> {
  const [{ total, results: lexical }, semantic] = await Promise.all([
    lexicalSearch(query, filters, 0, MAX_CANDIDATES),
    searchSemantic(query, filters, SEMANTIC_MATCH_COUNT),
  ]);

  let fused = fuseByRank(lexical, semantic, HYBRID_FUSE_COUNT);

  if (fused.length > 0) {
    const scores = await rerank(
      query,
      fused.map((hit) => hit.text)
    );
    if (scores) {
      fused = fused
        .map((hit, i) => ({ hit, score: scores[i] }))
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.hit);
    }
  }

  const offset = (page - 1) * PAGE_SIZE;
  return { total: fused.length, results: fused.slice(offset, offset + PAGE_SIZE) };
}

function serializeItem(doc: Record<string, any>): ItemHit {
  return {
    id: doc.$id,
    slug: doc.slug,
    type: doc.type,
    title: doc.title,
    status: doc.status,
    source: doc.source ?? null,
    updated_at: doc.updated_at,
    body: doc.body ?? null,
    document_id: doc.document_id ?? null,
  };
}

async function searchItems(query: string, filters: Filters) {
  if (query) {
    const [titleRes, bodyRes] = await Promise.all([
      databases.listDocuments(DB, ITEMS, [Query.search("title", query), Query.limit(50)]),
      databases.listDocuments(DB, ITEMS, [Query.search("body", query), Query.limit(50)]),
    ]);
    const map = new Map<string, ItemHit>();
    for (const d of [...titleRes.documents, ...bodyRes.documents]) {
      if (!map.has(d.$id)) map.set(d.$id, serializeItem(d));
    }
    let results = [...map.values()];
    if (hasFilters(filters)) {
      const res = await databases.listDocuments(DB, ITEMS, [
        ...filterQueries(filters),
        Query.limit(50),
      ]);
      const allowed = new Set(res.documents.map((d) => d.$id));
      results = results.filter((r) => allowed.has(r.id));
    }
    results.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return results;
  }

  const res = await databases.listDocuments(DB, ITEMS, [
    ...filterQueries(filters),
    Query.orderDesc("updated_at"),
    Query.limit(50),
  ]);
  return res.documents.map(serializeItem);
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 50, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim().slice(0, 200);
  const modeParam = searchParams.get("mode");
  const mode =
    modeParam === "items" || modeParam === "semantic" || modeParam === "hybrid"
      ? modeParam
      : "exact";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const filters = readFilters(searchParams);

  try {
    if (mode === "items") {
      const results = await searchItems(query, filters);
      return Response.json({ mode, query, results });
    }

    if (!query) {
      return Response.json({ mode, query, total: 0, page, pageSize: PAGE_SIZE, results: [] });
    }

    let total: number;
    let results: ChunkHit[];
    if (mode === "semantic") {
      const all = await searchSemantic(query, filters, SEMANTIC_MATCH_COUNT);
      total = all.length;
      const offset = (page - 1) * PAGE_SIZE;
      results = all.slice(offset, offset + PAGE_SIZE);
      if (total === 0) {
        const fallback = await searchExact(query, page, filters);
        total = fallback.total;
        results = fallback.results;
      }
    } else if (mode === "hybrid") {
      ({ total, results } = await searchHybrid(query, page, filters));
    } else {
      ({ total, results } = await searchExact(query, page, filters));
    }

    if (user.email) {
      await recordSearchHistory(user.email, query, mode, total);
    }
    return Response.json({ mode, query, total, page, pageSize: PAGE_SIZE, results });
  } catch {
    return Response.json({ mode, query, total: 0, page, pageSize: PAGE_SIZE, results: [] });
  }
}
