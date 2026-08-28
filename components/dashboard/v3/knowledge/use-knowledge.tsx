"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  dashboardKeys,
  knowledgeItemQuery,
  knowledgeQuery,
  type KnowledgeRecord,
} from "@/lib/dashboard/queries"

export type KnowledgeItem = KnowledgeRecord

type KnowledgeContextValue = {
  selected: string | null
  setSelected: (id: string | null) => void
  selectedItem: KnowledgeItem | null

  category: string
  setCategory: (category: string) => void

  items: KnowledgeItem[]
  loading: boolean
  error: string | null

  searchQuery: string
  setSearchQuery: (q: string) => void

  addOpen: boolean
  setAddOpen: (open: boolean) => void

  refresh: () => void
  syncFilesystem: () => Promise<void>

  createNote: () => Promise<void>
  saveItem: (id: string, patch: { title?: string; content?: string; tags?: string[] }) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}

const KnowledgeContext = React.createContext<KnowledgeContextValue | null>(null)

/** Matches every cached knowledge list regardless of its search/category key. */
const KNOWLEDGE_LIST_SCOPE = { queryKey: ["knowledge", "list"] } as const

export function useKnowledge() {
  const ctx = React.useContext(KnowledgeContext)
  if (!ctx) throw new Error("useKnowledge must be used inside <KnowledgeProvider>")
  return ctx
}

export function KnowledgeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = React.useState<string | null>(null)
  const [category, setCategory] = React.useState("All")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [addOpen, setAddOpen] = React.useState(false)
  const [syncing, setSyncing] = React.useState(false)

  // Debounce the typed query into the value that actually keys the request, so
  // each distinct search still gets its own cache entry (retyping a previous
  // search is then instant) without firing a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  React.useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  const listQuery = useQuery(knowledgeQuery(debouncedSearch, category))
  const items = listQuery.data ?? []

  // The list only carries search-result fields (no body). Opening an item fetches
  // the full record, showing the list version in the meantime so the editor never
  // blanks out.
  const fromList = React.useMemo(
    () => (selected ? items.find((item) => item.id === selected) : undefined),
    [selected, items]
  )

  const detailQuery = useQuery({
    ...knowledgeItemQuery(selected ?? ""),
    enabled: Boolean(selected),
    placeholderData: fromList,
  })

  const selectedItem = selected ? detailQuery.data ?? fromList ?? null : null

  const refresh = React.useCallback(() => {
    void listQuery.refetch()
  }, [listQuery])

  const syncFilesystem = React.useCallback(async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/knowledge/sync", { method: "POST" })
      if (!res.ok) throw new Error("Sync failed")
      const data = await res.json()
      toast.success(`Synced ${data.count} items from filesystem`)
      await queryClient.invalidateQueries(KNOWLEDGE_LIST_SCOPE)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSyncing(false)
    }
  }, [queryClient])

  const createNote = React.useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled note", content: "", category: "note", source: "dashboard" }),
      })
      if (!res.ok) throw new Error("Failed to create note")
      const data = await res.json()
      // Switching category re-keys the list query, which refetches on its own.
      setCategory("note")
      await queryClient.invalidateQueries(KNOWLEDGE_LIST_SCOPE)
      setSelected(data.item.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create note")
    }
  }, [queryClient])

  const saveItem = React.useCallback(
    async (id: string, patch: { title?: string; content?: string; tags?: string[] }) => {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error((typeof err?.error === "string" ? err.error : err?.error?.message) || "Failed to save")
      }
      const updated = (await res.json()) as KnowledgeItem
      queryClient.setQueryData(dashboardKeys.knowledgeItem(id), updated)
      queryClient.setQueriesData<KnowledgeItem[]>(KNOWLEDGE_LIST_SCOPE, (prev) =>
        prev?.map((item) => (item.id === id ? { ...item, ...updated } : item))
      )
    },
    [queryClient]
  )

  const deleteItem = React.useCallback(
    async (id: string) => {
      const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error((typeof err?.error === "string" ? err.error : err?.error?.message) || "Failed to delete")
      }
      queryClient.setQueriesData<KnowledgeItem[]>(KNOWLEDGE_LIST_SCOPE, (prev) =>
        prev?.filter((item) => item.id !== id)
      )
      queryClient.removeQueries({ queryKey: dashboardKeys.knowledgeItem(id) })
      setSelected((prev) => (prev === id ? null : prev))
    },
    [queryClient]
  )

  return (
    <KnowledgeContext.Provider value={{
      selected, setSelected,
      selectedItem,
      category, setCategory,
      items,
      loading: listQuery.isPending || syncing,
      error: listQuery.error ? String(listQuery.error) : null,
      searchQuery, setSearchQuery,
      addOpen, setAddOpen,
      refresh,
      syncFilesystem,
      createNote,
      saveItem,
      deleteItem,
    }}>
      {children}
    </KnowledgeContext.Provider>
  )
}
