import type { DashboardResponse } from "@/lib/dashboard/types"
import { leadsListQuery } from "@/lib/leads/queries"

/**
 * Single source of truth for the dashboard's client-side reads.
 *
 * Both the consuming `useQuery` call and the nav hover-prefetch import their
 * options from here. That is not tidiness for its own sake: `prefetchQuery` only
 * warms a later `useQuery` if the query key AND the fetcher agree. Defining a
 * key in one place and re-deriving it at the prefetch site is how you end up
 * with a "prefetch" that silently populates a cache entry nobody reads.
 */

export type DocumentRecord = {
  id: string
  title: string
  filename: string
  mime_type: string
  size_bytes: number
  storage_path: string
  url: string
  tags: string[]
  status: string
  author: string
  created_at: string
}

export type KnowledgeRecord = {
  id: string
  slug: string
  type: string
  title: string
  status: string
  source: string
  updated_at: string
  body?: string
  document_id?: string | null
}

async function fetchJson<T>(url: string, message: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(message)
  return (await res.json()) as T
}

export const dashboardKeys = {
  summary: ["dashboard", "summary"] as const,
  documents: ["documents", "list"] as const,
  document: (id: string) => ["documents", "detail", id] as const,
  knowledge: (search: string, category: string) =>
    ["knowledge", "list", search, category] as const,
  knowledgeItem: (id: string) => ["knowledge", "detail", id] as const,
}

export const dashboardSummaryQuery = {
  queryKey: dashboardKeys.summary,
  queryFn: () => fetchJson<DashboardResponse>("/api/dashboard", "Failed to load dashboard"),
}

export const documentsQuery = {
  queryKey: dashboardKeys.documents,
  // The API returns a paginated envelope: { data, total, page, pageSize }.
  queryFn: async () => {
    const json = await fetchJson<{ data?: DocumentRecord[] }>(
      "/api/documents",
      "Failed to fetch documents"
    )
    return json.data ?? []
  },
}

export function knowledgeQuery(search: string, category: string) {
  return {
    queryKey: dashboardKeys.knowledge(search, category),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set("q", search)
      if (category !== "All") params.set("type", category.toLowerCase())
      params.set("mode", "items")
      const json = await fetchJson<{ results?: KnowledgeRecord[] }>(
        `/api/knowledge/search?${params}`,
        "Failed to fetch knowledge base"
      )
      return json.results ?? []
    },
  }
}

export function knowledgeItemQuery(id: string) {
  return {
    queryKey: dashboardKeys.knowledgeItem(id),
    queryFn: () =>
      fetchJson<KnowledgeRecord>(`/api/knowledge/${id}`, "Failed to load knowledge item"),
  }
}

/**
 * Routes whose data layer is backed by React Query, mapped to the query to warm
 * when the user hovers/focuses the matching sidebar link.
 *
 * Only converted sections appear here on purpose. Warming a key that no
 * `useQuery` reads would burn a request for nothing; those routes still get
 * their RSC payload prefetched by `<Link prefetch>`.
 */
export const NAV_PREFETCH: Record<string, () => { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }> = {
  "/dashboard": () => dashboardSummaryQuery,
  "/documents": () => documentsQuery,
  "/knowledge": () => knowledgeQuery("", "All"),
  "/leads": () => leadsListQuery({ page: 1, pageSize: 50 }),
}
