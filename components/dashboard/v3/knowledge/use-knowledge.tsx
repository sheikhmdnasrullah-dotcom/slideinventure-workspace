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

  React.useEffect(() => {
    if (!selected) {
      setSelectedItem(null)
      return
    }
    const item = items.find((d) => d.id === selected)
    setSelectedItem(item || null)
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

  return (
    <KnowledgeContext.Provider value={{
      selected, setSelected,
      selectedItem,
      category, setCategory,
      items, loading, error,
      searchQuery, setSearchQuery,
      addOpen, setAddOpen,
      refresh: () => fetchItems(searchQuery, category),
      syncFilesystem,
    }}>
      {children}
    </KnowledgeContext.Provider>
  )
}
