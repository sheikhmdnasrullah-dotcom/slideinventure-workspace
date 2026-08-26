"use client"

import * as React from "react"
import { toast } from "sonner"

export type KnowledgeItem = {
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

export function useKnowledge() {
  const ctx = React.useContext(KnowledgeContext)
  if (!ctx) throw new Error("useKnowledge must be used inside <KnowledgeProvider>")
  return ctx
}

export function KnowledgeProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = React.useState<string | null>(null)
  const [selectedItem, setSelectedItem] = React.useState<KnowledgeItem | null>(null)
  const [category, setCategory] = React.useState("All")
  const [items, setItems] = React.useState<KnowledgeItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [addOpen, setAddOpen] = React.useState(false)

  const fetchItems = React.useCallback(async (q: string, cat: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set("q", q)
      if (cat !== "All") params.set("type", cat.toLowerCase())
      params.set("mode", "items")

      const res = await fetch(`/api/knowledge/search?${params}`)
      if (!res.ok) throw new Error("Failed to fetch knowledge base")
      const data = await res.json()
      setItems(data.results || [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      fetchItems(searchQuery, category)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, category, fetchItems])

  const refresh = React.useCallback(() => fetchItems(searchQuery, category), [fetchItems, searchQuery, category])

  // The list only carries search-result fields (no body) — opening an item
  // fetches the full record so editing always starts from real content.
  React.useEffect(() => {
    let cancelled = false
    if (!selected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing selection to the current `selected` id, not a render loop
      setSelectedItem(null)
      return
    }
    const fromList = items.find((d) => d.id === selected)
    setSelectedItem(fromList || null)
    fetch(`/api/knowledge/${selected}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((full) => {
        if (!cancelled && full) setSelectedItem(full)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [selected, items])

  const syncFilesystem = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/knowledge/sync", { method: "POST" })
      if (!res.ok) throw new Error("Sync failed")
      const data = await res.json()
      toast.success(`Synced ${data.count} items from filesystem`)
      fetchItems(searchQuery, category)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setLoading(false)
    }
  }, [fetchItems, searchQuery, category])

  const createNote = React.useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled note", content: "", category: "note", source: "dashboard" }),
      })
      if (!res.ok) throw new Error("Failed to create note")
      const data = await res.json()
      setCategory("note")
      await fetchItems(searchQuery, "note")
      setSelected(data.item.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create note")
    }
  }, [fetchItems, searchQuery])

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
      const updated = await res.json()
      setSelectedItem(updated)
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updated } : it)))
    },
    []
  )

  const deleteItem = React.useCallback(
    async (id: string) => {
      const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error((typeof err?.error === "string" ? err.error : err?.error?.message) || "Failed to delete")
      }
      setItems((prev) => prev.filter((it) => it.id !== id))
      if (selected === id) setSelected(null)
    },
    [selected]
  )

  return (
    <KnowledgeContext.Provider value={{
      selected, setSelected,
      selectedItem,
      category, setCategory,
      items, loading, error,
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
