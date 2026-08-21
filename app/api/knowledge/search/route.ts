import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import { embedTexts, rerank } from "@/lib/knowledge/nvidia";

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
  knowledge_items?: unknown;
};

// PostgREST or() filters split on top-level commas/parens; wrapping the value
// in double quotes protects those characters, so only backslash and the
// quote itself need escaping. See https://postgrest.org/en/stable/references/api/tables_views.html#operators
function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// Escapes ILIKE wildcard characters so a fuzzy-fallback query can't be used
// to widen its own match pattern.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

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

// Resolves type/status/tag/date filters to a list of matching knowledge_item
// ids, so chunk queries can narrow with a single .in(). Returns null when no
// filters are set (meaning: don't narrow).
async function resolveFilteredItemIds(
  supabase: ReturnType<typeof createServiceClient>,
  filters: Filters
): Promise<string[] | null> {
  if (!hasFilters(filters)) return null;

  let query = supabase.from("knowledge_items").select("id").limit(1000);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.tag) query = query.contains("tags", [filters.tag]);
  if (filters.dateFrom) query = query.gte("updated_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("updated_at", filters.dateTo);

  const { data } = await query;
  return (data ?? []).map((row) => row.id as string);
}

async function recordSearchHistory(
  supabase: ReturnType<typeof createServiceClient>,
  userEmail: string,
  query: string,
  mode: string,
  resultCount: number
) {
  if (!query) return;
  try {
    await supabase.from("knowledge_search_history").insert({
      user_email: userEmail,
      query,
      mode,
      result_count: resultCount,
    });
  } catch {
    // history is a convenience feature, not load-bearing — don't fail the search over it
  }
}

async function lexicalSearch(
  supabase: ReturnType<typeof createServiceClient>,
  query: string,
  filters: Filters,
  offset: number,
  limit: number
): Promise<{ total: number; results: ChunkHit[] }> {
  const itemIds = await resolveFilteredItemIds(supabase, filters);
  if (itemIds !== null && itemIds.length === 0) {
    return { total: 0, results: [] };
  }

  const rangeEnd = offset + limit - 1;
  const selectCols =
    "id, knowledge_item_id, chunk_index, heading, text, start_offset, end_offset, knowledge_items(slug, title, type, source, status, updated_at)";

  let ftsQuery = supabase
    .from("knowledge_chunks")
    .select(selectCols, { count: "exact" })
    .textSearch("search_vector", query, { type: "websearch", config: "english" })
    .range(offset, rangeEnd);
  if (itemIds) ftsQuery = ftsQuery.in("knowledge_item_id", itemIds);

  const ftsResult = await ftsQuery;

  if ((ftsResult.count ?? 0) > 0) {
    return { total: ftsResult.count ?? 0, results: (ftsResult.data as ChunkHit[] | null) ?? [] };
  }

  // No FTS hits (e.g. a typo, or a term tsvector wouldn't stem to) — fall
  // back to a trigram-indexed substring match for typo tolerance.
  let likeQuery = supabase
    .from("knowledge_chunks")
    .select(selectCols, { count: "exact" })
    .ilike("text", `%${escapeLike(query)}%`)
    .range(offset, rangeEnd);
  if (itemIds) likeQuery = likeQuery.in("knowledge_item_id", itemIds);

  const likeResult = await likeQuery;
  return { total: likeResult.count ?? 0, results: (likeResult.data as ChunkHit[] | null) ?? [] };
}

async function searchExact(
  supabase: ReturnType<typeof createServiceClient>,
  query: string,
  page: number,
  filters: Filters
) {
  const offset = (page - 1) * PAGE_SIZE;
  const limit = Math.min(PAGE_SIZE, MAX_CANDIDATES - offset);
  if (limit <= 0) return { total: 0, results: [] };
  return lexicalSearch(supabase, query, filters, offset, limit);
}

// Attaches parent knowledge_items to RPC results (the RPC can't express
// PostgREST's embedded-resource join), giving semantic/hybrid hits the same
// shape lexical hits already have — one results component for every mode.
async function attachItems(
  supabase: ReturnType<typeof createServiceClient>,
  rows: ChunkHit[]
): Promise<ChunkHit[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => r.knowledge_item_id))];
  const { data } = await supabase
    .from("knowledge_items")
    .select("id, slug, title, type, source, status, updated_at")
    .in("id", ids);
  const byId = new Map((data ?? []).map((item) => [item.id as string, item]));
  return rows.map((row) => ({ ...row, knowledge_items: byId.get(row.knowledge_item_id) ?? null }));
}

async function searchSemantic(
  supabase: ReturnType<typeof createServiceClient>,
  query: string,
  filters: Filters,
  matchCount: number
): Promise<ChunkHit[]> {
  const itemIds = await resolveFilteredItemIds(supabase, filters);
  if (itemIds !== null && itemIds.length === 0) return [];

  const vectors = await embedTexts([query], "query");
  if (!vectors) return [];

  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: vectors[0],
    match_count: matchCount,
    filter_item_ids: itemIds,
  });
  if (error || !data) return [];

  return attachItems(supabase, data as ChunkHit[]);
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

async function searchHybrid(
  supabase: ReturnType<typeof createServiceClient>,
  query: string,
  page: number,
  filters: Filters
): Promise<{ total: number; results: ChunkHit[] }> {
  const [{ results: lexical }, semantic] = await Promise.all([
    lexicalSearch(supabase, query, filters, 0, MAX_CANDIDATES),
    searchSemantic(supabase, query, filters, SEMANTIC_MATCH_COUNT),
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

async function searchItems(
  supabase: ReturnType<typeof createServiceClient>,
  query: string,
  filters: Filters
) {
  let dbQuery = supabase
    .from("knowledge_items")
    .select("id, slug, type, title, status, source, updated_at, body")
    .limit(50);

  if (query) {
    const q = escapeFilterValue(query);
    dbQuery = dbQuery.or(`title.ilike."%${q}%",body.ilike."%${q}%",tags.cs.{"${q}"}`);
  }
  if (filters.type) dbQuery = dbQuery.eq("type", filters.type);
  if (filters.status) dbQuery = dbQuery.eq("status", filters.status);
  if (filters.tag) dbQuery = dbQuery.contains("tags", [filters.tag]);
  if (filters.dateFrom) dbQuery = dbQuery.gte("updated_at", filters.dateFrom);
  if (filters.dateTo) dbQuery = dbQuery.lte("updated_at", filters.dateTo);

  const result = await dbQuery.order("updated_at", { ascending: false });
  return result.data ?? [];
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
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
      const results = await searchItems(supabase, query, filters);
      return Response.json({ mode, query, results });
    }

    if (!query) {
      return Response.json({ mode, query, total: 0, page, pageSize: PAGE_SIZE, results: [] });
    }

    let total: number;
    let results: ChunkHit[];
    if (mode === "semantic") {
      // No pagination against the vector index — just the top match_count,
      // sliced client-side like hybrid's fused list.
      const all = await searchSemantic(supabase, query, filters, SEMANTIC_MATCH_COUNT);
      total = all.length;
      const offset = (page - 1) * PAGE_SIZE;
      results = all.slice(offset, offset + PAGE_SIZE);
      // Semantic-only mode returned no hits (likely NVIDIA_API_KEY missing or
      // the API call failed) — degrade to lexical rather than showing nothing.
      if (total === 0) {
        const fallback = await searchExact(supabase, query, page, filters);
        total = fallback.total;
        results = fallback.results;
      }
    } else if (mode === "hybrid") {
      ({ total, results } = await searchHybrid(supabase, query, page, filters));
    } else {
      ({ total, results } = await searchExact(supabase, query, page, filters));
    }

    if (user.email) {
      await recordSearchHistory(supabase, user.email, query, mode, total);
    }
    return Response.json({ mode, query, total, page, pageSize: PAGE_SIZE, results });
  } catch {
    // Supabase unreachable; return empty results
    return Response.json({ mode, query, total: 0, page, pageSize: PAGE_SIZE, results: [] });
  }
}
