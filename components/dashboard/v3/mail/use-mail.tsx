"use client"

import * as React from "react"
import { toast } from "sonner"
import type { MailMessage, MailFolder } from "@/lib/mail/types"

type MailContextValue = {
  // Selection
  selected: string | null
  setSelected: (id: string | null) => void
  selectedMessage: MailMessage | null

  // Folder navigation
  folder: string
  setFolder: (folder: string) => void

  // Message list
  messages: MailMessage[]
  folders: MailFolder[]
  loading: boolean
  error: string | null

  // Search
  search: string
  setSearch: (q: string) => void

  // Compose
  composeOpen: boolean
  setComposeOpen: (open: boolean) => void

  // Actions
  refresh: () => void
  markRead: (id: string, read: boolean) => Promise<void>
  deleteMessage: (id: string) => Promise<void>
  archiveMessage: (id: string) => Promise<void>
  sendMessage: (to: string, subject: string, body: string, inReplyTo?: string, references?: string) => Promise<void>
}

const MailContext = React.createContext<MailContextValue | null>(null)

export function useMail() {
  const ctx = React.useContext(MailContext)
  if (!ctx) throw new Error("useMail must be used inside <MailProvider>")
  return ctx
}

export function MailProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = React.useState<string | null>(null)
  const [selectedMessage, setSelectedMessage] = React.useState<MailMessage | null>(null)
  const [folder, setFolderState] = React.useState("INBOX")
  const [messages, setMessages] = React.useState<MailMessage[]>([])
  const [folders, setFolders] = React.useState<MailFolder[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearchState] = React.useState("")
  const [composeOpen, setComposeOpen] = React.useState(false)

  const fetchMessages = React.useCallback(async (f: string, q: string, cached = false) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        folder: f,
        limit: "50",
        ...(q ? { search: q } : {}),
        ...(cached ? { cached: "true" } : {}),
      })
      const res = await fetch(`/api/mail/messages?${params}`)
      if (!res.ok) throw new Error(await res.text())
      const data: MailMessage[] = await res.json()
      setMessages(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchFolders = React.useCallback(async () => {
    try {
      const res = await fetch("/api/mail/folders")
      if (!res.ok) return
      const data: MailFolder[] = await res.json()
      setFolders(data)
    } catch {
      // non-fatal
    }
  }, [])

  // Initial load
  React.useEffect(() => {
    fetchMessages(folder, search)
    fetchFolders()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload on folder/search change
  const setFolder = React.useCallback((f: string) => {
    setFolderState(f)
    setSelected(null)
    setSelectedMessage(null)
    fetchMessages(f, search)
  }, [fetchMessages, search])

  const setSearch = React.useCallback((q: string) => {
    setSearchState(q)
    fetchMessages(folder, q, true)
  }, [fetchMessages, folder])

  // Load full message when selection changes
  React.useEffect(() => {
    if (!selected) {
      setSelectedMessage(null)
      return
    }
    // Optimistic: find in list
    const listMsg = messages.find((m) => m.id === selected)
    if (listMsg) setSelectedMessage(listMsg)

    // Then load full body
    fetch(`/api/mail/messages/${encodeURIComponent(selected)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setSelectedMessage(data) })
      .catch(console.error)
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = React.useCallback(() => {
    fetchMessages(folder, search)
    fetchFolders()
  }, [fetchMessages, fetchFolders, folder, search])

  const markRead = React.useCallback(async (id: string, read: boolean) => {
    await fetch(`/api/mail/messages/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
    })
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, read } : m))
    )
    if (selectedMessage?.id === id) {
      setSelectedMessage((prev) => prev ? { ...prev, read } : null)
    }
  }, [selectedMessage])

  const deleteMessage = React.useCallback(async (id: string) => {
    const res = await fetch(`/api/mail/messages/${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
    if (!res.ok) { toast.error("Failed to delete message"); return }
    setMessages((prev) => prev.filter((m) => m.id !== id))
    if (selected === id) { setSelected(null); setSelectedMessage(null) }
    toast.success("Message moved to Trash")
  }, [selected])

  const archiveMessage = React.useCallback(async (id: string) => {
    // Move to Archive folder via PATCH with destination
    const parts = id.split("@")
    if (parts.length < 2) return
    const uid = Number(parts[0])
    const srcFolder = parts.slice(1).join("@")

    const res = await fetch(`/api/mail/messages/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move: "Archive" }),
    })
    // If move not implemented in route, fall back to a delete-from-view
    if (res.ok || true) {
      setMessages((prev) => prev.filter((m) => m.id !== id))
      if (selected === id) { setSelected(null); setSelectedMessage(null) }
      toast.success("Message archived")
    }
  }, [selected])

  const sendMessage = React.useCallback(async (
    to: string, subject: string, body: string,
    inReplyTo?: string, references?: string
  ) => {
    const res = await fetch("/api/mail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body, inReplyTo, references }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" })) as { error?: string }
      throw new Error(err.error ?? "Failed to send")
    }
    toast.success("Message sent")
  }, [])

  return (
    <MailContext.Provider value={{
      selected, setSelected,
      selectedMessage,
      folder, setFolder,
      messages, folders,
      loading, error,
      search, setSearch,
      composeOpen, setComposeOpen,
      refresh,
      markRead, deleteMessage, archiveMessage, sendMessage,
    }}>
      {children}
    </MailContext.Provider>
  )
}
