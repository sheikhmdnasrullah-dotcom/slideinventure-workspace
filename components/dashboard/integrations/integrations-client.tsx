"use client"

import { useEffect, useMemo, useState } from "react"
import { Cable, Edit, MoreVertical, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type SaveStatus = "idle" | "saving" | "error"

type IntegrationRecord = {
  id: string
  name: string
  provider: string
  type: "oauth" | "api_key" | "webhook" | "imap" | "smtp"
  status: "active" | "inactive" | "error"
  last_sync_at?: string | null
  last_error?: string | null
}

type IntegrationForm = {
  name: string
  provider: string
  type: IntegrationRecord["type"]
  status: IntegrationRecord["status"]
}

const EMPTY_FORM: IntegrationForm = {
  name: "",
  provider: "",
  type: "api_key",
  status: "inactive",
}

export function IntegrationsClient() {
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingIntegration, setEditingIntegration] = useState<IntegrationRecord | null>(null)
  const [form, setForm] = useState<IntegrationForm>(EMPTY_FORM)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")

  async function fetchIntegrations() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/integrations?pageSize=100", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load integrations")
      const json = await res.json()
      setIntegrations(json.data ?? [])
    } catch (fetchError) {
      setError((fetchError as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void fetchIntegrations()
    })
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return integrations
    return integrations.filter((integration) =>
      integration.name.toLowerCase().includes(query) ||
      integration.provider.toLowerCase().includes(query) ||
      integration.type.toLowerCase().includes(query) ||
      integration.status.toLowerCase().includes(query)
    )
  }, [integrations, search])

  function openDialog(integration?: IntegrationRecord) {
    if (integration) {
      setEditingIntegration(integration)
      setForm({
        name: integration.name,
        provider: integration.provider,
        type: integration.type,
        status: integration.status,
      })
    } else {
      setEditingIntegration(null)
      setForm(EMPTY_FORM)
    }
    setSaveStatus("idle")
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaveStatus("saving")
    try {
      const res = await fetch(editingIntegration ? `/api/integrations/${editingIntegration.id}` : "/api/integrations", {
        method: editingIntegration ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, config: {} }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error?.message || "Failed to save integration")
      }

      toast.success(editingIntegration ? "Integration updated" : "Integration saved")
      setDialogOpen(false)
      setSaveStatus("idle")
      await fetchIntegrations()
    } catch (saveError) {
      setSaveStatus("error")
      toast.error((saveError as Error).message)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/integrations/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error?.message || "Failed to delete integration")
      }
      toast.success("Integration removed")
      await fetchIntegrations()
    } catch (deleteError) {
      toast.error((deleteError as Error).message)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">Integrations</h1>
        <p className="text-xs text-foreground/40">Connected services, sync states, and future workspace capabilities live here.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search integrations..." className="pl-9" />
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="mr-2 size-4" />
          Add integration
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">Loading integrations…</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center gap-3 text-sm text-muted-foreground">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void fetchIntegrations()}>Retry</Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Cable className="size-6" />
            <span>No integrations saved yet.</span>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((integration) => (
            <Card key={integration.id} className="group relative">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="flex items-start gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted ring-1 ring-border">
                    <Cable className="size-4.5 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base">{integration.name}</CardTitle>
                    <CardDescription>{integration.provider} · {integration.type}</CardDescription>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex size-8 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100">
                    <MoreVertical className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openDialog(integration)}>
                      <Edit className="mr-2 size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleDelete(integration.id)} className="text-destructive">
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-foreground">{integration.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last sync</span>
                  <span>{integration.last_sync_at ? new Date(integration.last_sync_at).toLocaleString() : "Never"}</span>
                </div>
                {integration.last_error ? <p className="text-xs text-destructive">{integration.last_error}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingIntegration ? "Edit integration" : "Add integration"}</DialogTitle>
            <DialogDescription>Records are saved immediately to the backend and remain after refresh.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="integration-name">Name</Label>
              <Input id="integration-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Notion" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="integration-provider">Provider</Label>
              <Input id="integration-provider" value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))} placeholder="notion" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="integration-type">Type</Label>
                <Select value={form.type} onValueChange={(value) => value && setForm((current) => ({ ...current, type: value as IntegrationRecord["type"] }))}>
                  <SelectTrigger id="integration-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api_key">API key</SelectItem>
                    <SelectItem value="oauth">OAuth</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="imap">IMAP</SelectItem>
                    <SelectItem value="smtp">SMTP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="integration-status">Status</Label>
                <Select value={form.status} onValueChange={(value) => value && setForm((current) => ({ ...current, status: value as IntegrationRecord["status"] }))}>
                  <SelectTrigger id="integration-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="items-center justify-between sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Couldn’t save. Retry." : ""}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleSave()} disabled={saveStatus === "saving" || !form.name || !form.provider}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
