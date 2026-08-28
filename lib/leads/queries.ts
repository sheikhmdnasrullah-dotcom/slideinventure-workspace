import type { Lead } from "@/components/dashboard/leads-table"

/**
 * Query key + fetcher for the leads list, single source of truth so the
 * `useQuery` call and any future hover-prefetch agree on both. Matches the
 * convention in `lib/dashboard/queries.ts`.
 */

export type LeadsListParams = {
  page: number
  pageSize: number
  sortBy?: string
  sortOrder?: "asc" | "desc"
  search?: string
}

export type LeadsListResponse = {
  data: Lead[]
  total: number
  page: number
  pageSize: number
}

export const leadsKeys = {
  list: (params: LeadsListParams) => ["leads", "list", params] as const,
}

export function leadsListQuery(params: LeadsListParams) {
  return {
    queryKey: leadsKeys.list(params),
    queryFn: async (): Promise<LeadsListResponse> => {
      const qs = new URLSearchParams()
      qs.set("page", String(params.page))
      qs.set("pageSize", String(params.pageSize))
      if (params.sortBy) {
        qs.set("sortBy", params.sortBy)
        qs.set("sortOrder", params.sortOrder ?? "asc")
      }
      if (params.search) qs.set("search", params.search)

      const res = await fetch(`/api/leads?${qs.toString()}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load leads")
      const json = await res.json()
      return {
        data: json.data ?? [],
        total: json.total ?? 0,
        page: json.page ?? params.page,
        pageSize: json.pageSize ?? params.pageSize,
      }
    },
  }
}
