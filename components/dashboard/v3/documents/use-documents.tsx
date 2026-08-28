"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { dashboardKeys, documentsQuery, type DocumentRecord } from "@/lib/dashboard/queries"

export type Document = DocumentRecord

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
  const queryClient = useQueryClient()
  const [selected, setSelected] = React.useState<string | null>(null)
  const [folder, setFolder] = React.useState("All")
  const [search, setSearch] = React.useState("")
  const [uploadOpen, setUploadOpen] = React.useState(false)

  const { data, isPending, error, refetch } = useQuery(documentsQuery)
  const documents = data ?? []

  // `isPending` rather than `isFetching`: it is only true while there is nothing
  // to show. A revisit renders the cached list immediately and revalidates
  // silently in the background instead of flashing a skeleton.
  const loading = isPending

  // Derived, not mirrored into state. The old version kept `selectedDocument` in
  // its own state synced by an effect, which cost an extra render on every
  // selection and could briefly disagree with the list.
  const selectedDocument = React.useMemo(
    () => (selected ? documents.find((d) => d.id === selected) ?? null : null),
    [selected, documents]
  )

  const deleteDocument = React.useCallback(
    async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" })
      if (!res.ok) {
        toast.error("Failed to delete document")
        return
      }
      queryClient.setQueryData<Document[]>(dashboardKeys.documents, (prev) =>
        (prev ?? []).filter((d) => d.id !== id)
      )
      setSelected((prev) => (prev === id ? null : prev))
      toast.success("Document deleted")
    },
    [queryClient]
  )

  const refresh = React.useCallback(() => {
    void refetch()
  }, [refetch])

  return (
    <DocumentsContext.Provider value={{
      selected, setSelected,
      selectedDocument,
      folder, setFolder,
      documents,
      loading,
      error: error ? String(error) : null,
      search, setSearch,
      uploadOpen, setUploadOpen,
      refresh,
      deleteDocument,
    }}>
      {children}
    </DocumentsContext.Provider>
  )
}
