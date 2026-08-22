"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Copy, Eye, EyeOff, Plus, Search, Trash2, X, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AddVaultDialog, type VaultFormValues } from "./add-vault-dialog"
import { cn } from "@/lib/utils"

export type VaultEntry = {
  id: string
  name: string
  category?: string | null
  serviceName?: string | null
  username?: string | null
  secretType: string
  url?: string | null
  notes?: string | null
  tags?: string[]
  expiresAt?: string | null
  createdBy?: string | null
  createdAt: string
  updatedAt?: string
}

const CATEGORIES = [
  "cloud",
  "database",
  "email",
  "hosting",
  "monitoring",
  "payment",
  "saas",
  "security",
  "social",
  "other",
]

const SECRET_TYPES = [
  { value: "password", label: "Password" },
  { value: "api_key", label: "API Key" },
  { value: "secret", label: "Secret" },
  { value: "private_key", label: "Private Key" },
  { value: "public_key", label: "Public Key" },
  { value: "role_key", label: "Role Key" },
]

export function VaultEntries() {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [secretTypeFilter, setSecretTypeFilter] = useState("all")

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (categoryFilter !== "all") params.set("category", categoryFilter)

      const res = await fetch(`/api/vault?${params.toString()}`, { cache: "no-store" })
      if (res.ok) {
        const json = await res.json()
        setEntries(json.data ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/vault/${id}`, { method: "DELETE" })
      if (!res.ok) {
        toast.error("Delete failed")
        return
      }
      toast.success("Entry deleted")
      await loadEntries()
    } catch {
      toast.error("Delete failed")
    }
  }

  const handleSaved = () => {
    setEditingEntry(null)
    loadEntries()
  }

  const filteredEntries = useMemo(() => {
    let result = entries

    if (categoryFilter !== "all") {
      result = result.filter((e) => e.category === categoryFilter)
    }

    if (secretTypeFilter !== "all") {
      result = result.filter((e) => e.secretType === secretTypeFilter)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.serviceName?.toLowerCase().includes(q) ||
          e.username?.toLowerCase().includes(q) ||
          e.tags?.some((t) => t.toLowerCase().includes(q)) ||
          e.notes?.toLowerCase().includes(q)
      )
    }

    return result
  }, [entries, search, categoryFilter, secretTypeFilter])

  const categories = useMemo(() => {
    const cats = new Set(entries.map((e) => e.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [entries])

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vault..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="outline" className="text-xs">
            {filteredEntries.length}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Button size="sm" onClick={() => { setEditingEntry(null); setShowForm(true) }}>
            <Plus className="mr-2 size-4" />
            Add Secret
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label className="text-xs font-medium">Category</Label>
          <Select value={categoryFilter} onValueChange={(val: any) => setCategoryFilter(val || "all")}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium">Type</Label>
          <Select value={secretTypeFilter} onValueChange={(val: any) => setSecretTypeFilter(val || "all")}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {SECRET_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-sm">Loading vault...</span>
          </CardContent>
        </Card>
      ) : filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <Search className="size-6" />
              <span className="text-sm">No vault entries found.</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEntries.map((entry) => (
            <VaultCard
              key={entry.id}
              entry={entry}
              onDelete={() => handleDelete(entry.id)}
              onEdit={() => {
                setEditingEntry(entry)
                setShowForm(true)
              }}
            />
          ))}
        </div>
      )}

      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingEntry ? "Edit Secret" : "Add Secret"}</SheetTitle>
          </SheetHeader>
          <AddVaultDialog
            open={showForm}
            onOpenChange={setShowForm}
            onSaved={handleSaved}
            editingEntry={editingEntry as any}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}

function VaultCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: VaultEntry
  onEdit: () => void
  onDelete: () => void
}) {
  const [revealed, setRevealed] = useState(false)
  const [secretValue, setSecretValue] = useState<string | null>(null)
  const [loadingSecret, setLoadingSecret] = useState(false)
  const [copied, setCopied] = useState(false)
  const [reauthPassword, setReauthPassword] = useState("")
  const [reauthRequired, setReauthRequired] = useState(false)
  const [reauthLoading, setReauthLoading] = useState(false)

  const handleReveal = async () => {
    if (revealed) {
      setRevealed(false)
      setSecretValue(null)
      return
    }

    setLoadingSecret(true)
    try {
      const res = await fetch(`/api/vault/${entry.id}/reveal`, { method: "POST" })
      if (res.status === 400) {
        const json = await res.json().catch(() => ({}))
        if (json.error === "REAUTH_REQUIRED") {
          setReauthRequired(true)
          return
        }
      }
      if (!res.ok) {
        toast.error("Failed to reveal secret")
        return
      }
      const json = await res.json()
      setSecretValue(json.secret)
      setRevealed(true)

      setTimeout(() => {
        setRevealed(false)
        setSecretValue(null)
      }, 30000)
    } catch {
      toast.error("Failed to reveal secret")
    } finally {
      setLoadingSecret(false)
    }
  }

  const handleReauth = async (e: React.FormEvent) => {
    e.preventDefault()
    setReauthLoading(true)
    try {
      const res = await fetch("/api/vault/reauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: reauthPassword }),
      })
      if (!res.ok) {
        toast.error("Re-authentication failed")
        return
      }
      setReauthRequired(false)
      setReauthPassword("")
      handleReveal()
    } catch {
      toast.error("Re-authentication failed")
    } finally {
      setReauthLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!secretValue) return
    try {
      await navigator.clipboard.writeText(secretValue)
      setCopied(true)
      toast.success("Secret copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  const typeLabel = SECRET_TYPES.find((t) => t.value === entry.secretType)?.label ?? entry.secretType

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-sm font-medium">{entry.name}</CardTitle>
          {entry.serviceName && (
            <p className="text-xs text-muted-foreground">{entry.serviceName}</p>
          )}
          {entry.username && (
            <p className="text-xs text-muted-foreground">User: {entry.username}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={handleReveal}
                  disabled={loadingSecret}
                >
                  {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  <span className="sr-only">{revealed ? "Hide" : "Reveal"} secret</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{revealed ? "Hide secret" : "Reveal secret"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {revealed && secretValue && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={handleCopy}
                  >
                    <Copy className="size-3.5" />
                    <span className="sr-only">Copy secret</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{copied ? "Copied!" : "Copy secret"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button variant="ghost" size="icon" className="size-8" onClick={onEdit}>
            <EditIcon />
            <span className="sr-only">Edit</span>
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={onDelete}>
            <Trash2 className="size-3.5" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </CardHeader>
      {reauthRequired && (
        <CardContent className="flex flex-col gap-3 border-t">
          <p className="text-xs font-medium">Re-authentication required</p>
          <form onSubmit={handleReauth} className="flex flex-col gap-2">
            <Input
              type="password"
              placeholder="Enter your password"
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              className="h-9"
              autoFocus
            />
            <Button type="submit" size="sm" disabled={reauthLoading}>
              {reauthLoading ? "Verifying..." : "Verify"}
            </Button>
          </form>
        </CardContent>
      )}
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="rounded-lg bg-muted/50 p-3">
          <code className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">
            {revealed && secretValue ? secretValue : "••••••••••••"}
          </code>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {typeLabel}
          </Badge>
          {entry.category && (
            <Badge variant="secondary" className="text-xs">
              {entry.category}
            </Badge>
          )}
          {(entry.tags ?? []).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        {entry.url && (
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <ExternalLink className="size-3" />
            {entry.url}
          </a>
        )}
        {entry.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2">{entry.notes}</p>
        )}
      </CardContent>
    </Card>
  )
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}
