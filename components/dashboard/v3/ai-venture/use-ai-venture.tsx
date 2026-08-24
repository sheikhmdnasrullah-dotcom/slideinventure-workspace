"use client"

import * as React from "react"
import { toast } from "sonner"

export type VentureNode = {
  path: string
  name: string
  type: "file" | "folder"
  ext: string | null
  size: number
  modifiedAt: string
  children?: VentureNode[]
}

export type SelectedFile = {
  path: string
  name: string
  content: string
  size: number
  modifiedAt: string
}

type SortBy = "name" | "modified" | "size"
type TypeFilter = "all" | "md" | "txt" | "pdf" | "brainstorm"

type AIVentureContextValue = {
  tree: VentureNode | null
  loading: boolean
  error: string | null

  currentPath: string
  navigateTo: (path: string) => void
  breadcrumbs: { name: string; path: string }[]

  entries: VentureNode[]

  searchQuery: string
  setSearchQuery: (q: string) => void
  sortBy: SortBy
  setSortBy: (s: SortBy) => void
  typeFilter: TypeFilter
  setTypeFilter: (t: TypeFilter) => void

  selectedPath: string | null
  selectedFile: SelectedFile | null
  fileLoading: boolean
  selectFile: (path: string) => void

  refresh: () => Promise<void>
  createEntry: (name: string, type: "file" | "folder") => Promise<void>
  renameEntry: (node: VentureNode, newName: string) => Promise<void>
  deleteEntry: (node: VentureNode) => Promise<void>
  saveFileContent: (path: string, content: string) => Promise<void>
}

const AIVentureContext = React.createContext<AIVentureContextValue | null>(null)

export function useAIVenture() {
  const ctx = React.useContext(AIVentureContext)
  if (!ctx) throw new Error("useAIVenture must be used inside <AIVentureProvider>")
  return ctx
}

function findFolder(node: VentureNode, targetPath: string): VentureNode | null {
  if (node.path === targetPath) return node
  if (!node.children) return null
  for (const child of node.children) {
    if (child.type === "folder") {
      const found = findFolder(child, targetPath)
      if (found) return found
    }
  }
  return null
}

export function AIVentureProvider({ children }: { children: React.ReactNode }) {
  const [tree, setTree] = React.useState<VentureNode | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [currentPath, setCurrentPath] = React.useState("")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [sortBy, setSortBy] = React.useState<SortBy>("name")
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all")

  const [selectedPath, setSelectedPath] = React.useState<string | null>(null)
  const [selectedFile, setSelectedFile] = React.useState<SelectedFile | null>(null)
  const [fileLoading, setFileLoading] = React.useState(false)

  const fetchTree = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ai-venture", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load AI Venture folder")
      const data = await res.json()
      setTree(data.tree)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchTree()
  }, [fetchTree])

  const navigateTo = React.useCallback((path: string) => {
    setCurrentPath(path)
    setSelectedPath(null)
    setSelectedFile(null)
  }, [])

  const breadcrumbs = React.useMemo(() => {
    const parts = currentPath ? currentPath.split("/") : []
    const crumbs: { name: string; path: string }[] = [{ name: "AI Venture", path: "" }]
    let acc = ""
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part
      crumbs.push({ name: part, path: acc })
    }
    return crumbs
  }, [currentPath])

  const entries = React.useMemo(() => {
    if (!tree) return []
    const folder = currentPath ? findFolder(tree, currentPath) : tree
    let list = folder?.children ?? []

    if (typeFilter !== "all") {
      list = list.filter((n) => n.type === "folder" || n.ext === `.${typeFilter}`)
    }
    if (typeFilter === "brainstorm") {
      list = list.filter((n) => n.name === "Brainstorm")
    }
    if (typeFilter === "pdf") {
      list = list.filter((n) => n.ext === ".pdf")
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((n) => n.name.toLowerCase().includes(q))
    }

    const sorted = [...list].sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1
      if (sortBy === "modified") return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
      if (sortBy === "size") return b.size - a.size
      return a.name.localeCompare(b.name)
    })
    return sorted
  }, [tree, currentPath, typeFilter, searchQuery, sortBy])

  const selectFile = React.useCallback(async (path: string) => {
    setSelectedPath(path)
    setFileLoading(true)
    try {
      const res = await fetch(`/api/ai-venture/file?path=${encodeURIComponent(path)}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to open file")
      const data = await res.json()
      setSelectedFile({ path: data.path, name: data.name, content: data.content, size: data.size, modifiedAt: data.modifiedAt })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to open file")
      setSelectedFile(null)
    } finally {
      setFileLoading(false)
    }
  }, [])

  const createEntry = React.useCallback(
    async (name: string, type: "file" | "folder") => {
      const targetPath = currentPath ? `${currentPath}/${name}` : name
      const res = await fetch("/api/ai-venture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: targetPath, type }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to create")
      }
      toast.success(`${type === "folder" ? "Folder" : "File"} created`)
      await fetchTree()
    },
    [currentPath, fetchTree]
  )

  const renameEntry = React.useCallback(
    async (node: VentureNode, newName: string) => {
      const parentPath = node.path.includes("/") ? node.path.slice(0, node.path.lastIndexOf("/")) : ""
      const newPath = parentPath ? `${parentPath}/${newName}` : newName
      const res = await fetch("/api/ai-venture/file", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: node.path, newPath }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to rename")
      }
      toast.success("Renamed")
      if (selectedPath === node.path) {
        setSelectedPath(null)
        setSelectedFile(null)
      }
      await fetchTree()
    },
    [fetchTree, selectedPath]
  )

  const deleteEntry = React.useCallback(
    async (node: VentureNode) => {
      const res = await fetch(`/api/ai-venture/file?path=${encodeURIComponent(node.path)}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to delete")
      }
      toast.success("Deleted")
      if (selectedPath === node.path) {
        setSelectedPath(null)
        setSelectedFile(null)
      }
      await fetchTree()
    },
    [fetchTree, selectedPath]
  )

  const saveFileContent = React.useCallback(
    async (path: string, content: string) => {
      const res = await fetch("/api/ai-venture/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to save")
      }
      toast.success("Saved")
      await fetchTree()
      await selectFile(path)
    },
    [fetchTree, selectFile]
  )

  return (
    <AIVentureContext.Provider
      value={{
        tree,
        loading,
        error,
        currentPath,
        navigateTo,
        breadcrumbs,
        entries,
        searchQuery,
        setSearchQuery,
        sortBy,
        setSortBy,
        typeFilter,
        setTypeFilter,
        selectedPath,
        selectedFile,
        fileLoading,
        selectFile,
        refresh: fetchTree,
        createEntry,
        renameEntry,
        deleteEntry,
        saveFileContent,
      }}
    >
      {children}
    </AIVentureContext.Provider>
  )
}
