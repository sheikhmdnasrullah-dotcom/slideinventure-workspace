"use client"

import * as React from "react"
import { toast } from "sonner"

export type Document = {
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

type DocumentsContextValue = {
  selected: string | null
  setSelected: (id: string | null) => void
  selectedDocument: Document | null

  folder: string
  setFolder: (folder: string) => void

  documents: Document[]
  loading: boolean
  error: string | null

  search: string
  setSearch: (q: string) => void

  uploadOpen: boolean
  setUploadOpen: (open: boolean) => void

  refresh: () => void
  deleteDocument: (id: string) => Promise<void>
}

const DocumentsContext = React.createContext<DocumentsContextValue | null>(null)

export function useDocuments() {
  const ctx = React.useContext(DocumentsContext)
  if (!ctx) throw new Error("useDocuments must be used inside <DocumentsProvider>")
  return ctx
}

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = React.useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = React.useState<Document | null>(null)
  const [folder, setFolder] = React.useState("All")
  const [documents, setDocuments] = React.useState<Document[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [uploadOpen, setUploadOpen] = React.useState(false)

  const fetchDocuments = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/documents`)
      if (!res.ok) throw new Error("Failed to fetch documents")
      const data: Document[] = await res.json()
      setDocuments(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Update selectedDocument when selected ID changes or documents list updates
  React.useEffect(() => {
    if (!selected) {
      setSelectedDocument(null)
      return
    }
    const doc = documents.find((d) => d.id === selected)
    setSelectedDocument(doc || null)
  }, [selected, documents])

  const deleteDocument = React.useCallback(async (id: string) => {
    const res = await fetch(`/api/documents/${id}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      toast.error("Failed to delete document")
      return
    }
    setDocuments((prev) => prev.filter((d) => d.id !== id))
    if (selected === id) {
      setSelected(null)
    }
    toast.success("Document deleted")
  }, [selected])

  return (
    <DocumentsContext.Provider value={{
      selected, setSelected,
      selectedDocument,
      folder, setFolder,
      documents, loading, error,
      search, setSearch,
      uploadOpen, setUploadOpen,
      refresh: fetchDocuments,
      deleteDocument,
    }}>
      {children}
    </DocumentsContext.Provider>
  )
}
