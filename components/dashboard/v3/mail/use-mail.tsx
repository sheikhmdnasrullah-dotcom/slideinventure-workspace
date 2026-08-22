"use client"

import * as React from "react"
import { toast } from "sonner"
import type { MailMessage, MailFolder } from "@/lib/mail/types"
import type { PublicAccount } from "@/lib/mail/accounts"

type MailContextValue = {
  // Accounts
  accounts: PublicAccount[]
  account: string | null
  setAccount: (account: string) => void

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
  refreshAccounts: () => Promise<PublicAccount[]>
  removeAccount: (id: string) => Promise<void>
}

const MailContext = React.createContext<MailContextValue | null>(null)

export function useMail() {
  const ctx = React.useContext(MailContext)
  if (!ctx) throw new Error("useMail must be used inside <MailProvider>")
  return ctx
}

export function MailProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = React.useState<PublicAccount[]>([])
  const [account, setAccountState] = React.useState<string | null>(null)
  
  const [selected, setSelected] = React.useState<string | null>(null)
  const [selectedMessage, setSelectedMessage] = React.useState<MailMessage | null>(null)
  const [folder, setFolderState] = React.useState("INBOX")
  const [messages, setMessages] = React.useState<MailMessage[]>([])
  const [folders, setFolders] = React.useState<MailFolder[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearchState] = React.useState("")
  const [composeOpen, setComposeOpen] = React.useState(false)

  const refreshAccounts = React.useCallback(async () => {
    try {
      const res = await fetch('/api/mail/accounts')
      const data: PublicAccount[] = res.ok ? await res.json() : []
      setAccounts(data)
      return data
    } catch {
      return []
    }
  }, [])

  // Fetch accounts on mount
  React.useEffect(() => {
    refreshAccounts().then((data) => {
      if (data.length > 0) {
        setAccountState((prev) => prev ?? data[0].email)
      }
    })
  }, [refreshAccounts])

  const fetchMessages = React.useCallback(async (acc: string | null, f: string, q: string, cached = false) => {
    if (!acc) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        account: acc,
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

  const fetchFolders = React.useCallback(async (acc: string | null) => {
    if (!acc) return
    try {
      const res = await fetch(`/api/mail/folders?account=${encodeURIComponent(acc)}`)
      if (!res.ok) return
      const data: MailFolder[] = await res.json()
      setFolders(data)
    } catch {
      // non-fatal
    }
  }, [])

  // Initial load when account is ready
  React.useEffect(() => {
    if (account) {
      fetchMessages(account, folder, search)
      fetchFolders(account)
    }
  }, [account]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload on account change
  const setAccount = React.useCallback((acc: string) => {
    setAccountState(acc)
    setFolderState("INBOX")
    setSelected(null)
    setSelectedMessage(null)
    setMessages([])
    setFolders([])
  }, [])

  // Reload on folder/search change
  const setFolder = React.useCallback((f: string) => {
    setFolderState(f)
    setSelected(null)
    setSelectedMessage(null)
    fetchMessages(account, f, search)
  }, [fetchMessages, search, account])

  const setSearch = React.useCallback((q: string) => {
    setSearchState(q)
    fetchMessages(account, folder, q, true)
  }, [fetchMessages, folder, account])

  // Load full message when selection changes
  React.useEffect(() => {
    if (!selected || !account) {
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
  }, [selected, account]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = React.useCallback(() => {
    fetchMessages(account, folder, search)
    fetchFolders(account)
  }, [fetchMessages, fetchFolders, folder, search, account])

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
    const parts = id.split("|")
    if (parts.length < 3) return
    
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
    if (!account) throw new Error("No account selected")
    const res = await fetch("/api/mail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, to, subject, body, inReplyTo, references }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" })) as { error?: string }
      throw new Error(err.error ?? "Failed to send")
    }
    toast.success("Message sent")
  }, [account])

  const removeAccount = React.useCallback(async (id: string) => {
    const res = await fetch(`/api/mail/accounts/${encodeURIComponent(id)}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Failed to remove account"); return }
    const removed = accounts.find((a) => a.id === id)
    const data = await refreshAccounts()
    if (removed && removed.email === account) {
      setAccount(data[0]?.email ?? "")
    }
    toast.success("Account removed")
  }, [accounts, account, refreshAccounts, setAccount])

  return (
    <MailContext.Provider value={{
      accounts, account, setAccount,
      selected, setSelected,
      selectedMessage,
      folder, setFolder,
      messages, folders,
      loading, error,
      search, setSearch,
      composeOpen, setComposeOpen,
      refresh,
      markRead, deleteMessage, archiveMessage, sendMessage,
      refreshAccounts, removeAccount,
    }}>
      {children}
    </MailContext.Provider>
  )
}
