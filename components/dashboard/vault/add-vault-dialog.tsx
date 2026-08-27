"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

export type VaultFormValues = {
  id?: string
  name: string
  category: string
  serviceName: string
  username: string
  secretType: string
  url: string
  notes: string
  tags: string[]
  encryptedValue: string
  expiresAt: string
  favorite: boolean
}

const emptyForm: VaultFormValues = {
  name: "",
  category: "",
  serviceName: "",
  username: "",
  secretType: "password",
  url: "",
  notes: "",
  tags: [],
  encryptedValue: "",
  expiresAt: "",
  favorite: false,
}

interface AddVaultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  editingEntry?: {
    id: string
    name: string
    category?: string | null
    serviceName?: string | null
    username?: string | null
    secretType?: string | null
    url?: string | null
    notes?: string | null
    tags?: string[]
    expiresAt?: string | null
    favorite?: boolean
  } | null
}

export function AddVaultDialog({ open, onOpenChange, onSaved, editingEntry }: AddVaultDialogProps) {
  const [form, setForm] = useState<VaultFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setSaveError(null)
        if (editingEntry) {
          setForm({
            id: editingEntry.id,
            name: editingEntry.name,
            category: editingEntry.category ?? "",
            serviceName: editingEntry.serviceName ?? "",
            username: editingEntry.username ?? "",
            secretType: editingEntry.secretType ?? "password",
            url: editingEntry.url ?? "",
            notes: editingEntry.notes ?? "",
            tags: editingEntry.tags ?? [],
            encryptedValue: "",
            expiresAt: editingEntry.expiresAt ?? "",
            favorite: editingEntry.favorite ?? false,
          })
        } else {
          setForm(emptyForm)
        }
      })
    }
  }, [open, editingEntry])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        ...form,
        tags: (form.tags ?? []).filter(Boolean),
      }

      const url = editingEntry ? `/api/vault/${editingEntry.id}` : "/api/vault"
      const method = editingEntry ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const message = editingEntry ? "Failed to update secret" : "Failed to add secret"
        setSaveError(message)
        toast.error(message)
        return
      }

      toast.success(editingEntry ? "Secret updated" : "Secret added")
      onSaved()
      onOpenChange(false)
    } catch {
      setSaveError("Something went wrong")
      toast.error("Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  const tagsString = (form.tags ?? []).join(", ")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editingEntry ? "Edit Secret" : "Add Secret"}</SheetTitle>
          <SheetDescription>
            {editingEntry ? "Update your secret details." : "Add a new secret to your vault."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Production Database"
              required
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Service Name</Label>
              <Input
                value={form.serviceName}
                onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
                placeholder="e.g. AWS, GitHub"
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Username</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="e.g. admin@example.com"
                className="h-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={form.category || ""} onValueChange={(val) => val && setForm({ ...form, category: val })}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cloud">Cloud</SelectItem>
                  <SelectItem value="database">Database</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="hosting">Hosting</SelectItem>
                  <SelectItem value="monitoring">Monitoring</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="saas">SaaS</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={form.secretType} onValueChange={(val) => val && setForm({ ...form, secretType: val })}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="password">Password</SelectItem>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="secret">Secret</SelectItem>
                  <SelectItem value="private_key">Private Key</SelectItem>
                  <SelectItem value="public_key">Public Key</SelectItem>
                  <SelectItem value="role_key">Role Key</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">URL</Label>
            <Input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com"
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Secret Value</Label>
            <Textarea
              value={form.encryptedValue}
              onChange={(e) => setForm({ ...form, encryptedValue: e.target.value })}
              placeholder="Enter the secret value..."
              required
              className="font-mono text-xs"
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Tags (comma-separated)</Label>
            <Input
              value={tagsString}
              onChange={(e) =>
                setForm({
                  ...form,
                  tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                })
              }
              placeholder="prod, database, aws"
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any additional context..."
              className="text-xs"
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Expires At (optional)</Label>
            <Input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className="h-9"
            />
          </div>
          <SheetFooter className="px-0">
            <div className="flex w-full items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {saving ? "Saving…" : saveError ? "Couldn’t save. Retry." : ""}
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <EditIcon />
                )}
                {editingEntry ? "Update Secret" : "Save Secret"}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
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
      className="mr-2 size-4"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}
