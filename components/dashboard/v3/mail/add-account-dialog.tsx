"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface AddAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => Promise<void> | void
}

const DEFAULT_IMAP_HOST = "mail.nasrullahtanim.me"
const DEFAULT_IMAP_PORT = 143
const DEFAULT_SMTP_PORT = 587

export function AddAccountDialog({ open, onOpenChange, onCreated }: AddAccountDialogProps) {
  const [provider, setProvider] = React.useState<"imap_smtp" | "google" | "microsoft">("imap_smtp")
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [imapHost, setImapHost] = React.useState(DEFAULT_IMAP_HOST)
  const [imapPort, setImapPort] = React.useState(String(DEFAULT_IMAP_PORT))
  const [smtpHost, setSmtpHost] = React.useState(DEFAULT_IMAP_HOST)
  const [smtpPort, setSmtpPort] = React.useState(String(DEFAULT_SMTP_PORT))
  const [saving, setSaving] = React.useState(false)

  function reset() {
    setProvider("imap_smtp")
    setName("")
    setEmail("")
    setPassword("")
    setImapHost(DEFAULT_IMAP_HOST)
    setImapPort(String(DEFAULT_IMAP_PORT))
    setSmtpHost(DEFAULT_IMAP_HOST)
    setSmtpPort(String(DEFAULT_SMTP_PORT))
  }

  async function handleSubmit() {
    if (!name || !email || !password || !imapHost || !smtpHost) {
      toast.error("Fill in all fields")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/mail/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, name, provider,
          imapHost, imapPort: Number(imapPort),
          smtpHost, smtpPort: Number(smtpPort),
          password,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to add account" })) as { error?: string }
        throw new Error(err.error ?? "Failed to add account")
      }
      toast.success("Account added")
      await onCreated()
      onOpenChange(false)
      reset()
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add mail account</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1">
            <Label className="text-xs font-medium">Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as typeof provider)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="imap_smtp">IMAP / SMTP</SelectItem>
                <SelectItem value="google" disabled>
                  Google Workspace: Not available
                </SelectItem>
                <SelectItem value="microsoft" disabled>
                  Microsoft 365: Not available
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1">
              <Label htmlFor="add-account-name" className="text-xs font-medium">Name</Label>
              <Input id="add-account-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Support" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="add-account-email" className="text-xs font-medium">Email</Label>
              <Input id="add-account-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
          </div>

          <div className="grid gap-1">
            <Label htmlFor="add-account-password" className="text-xs font-medium">Password</Label>
            <Input id="add-account-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1">
              <Label htmlFor="add-account-imap-host" className="text-xs font-medium">IMAP host</Label>
              <Input id="add-account-imap-host" value={imapHost} onChange={(e) => setImapHost(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="add-account-imap-port" className="text-xs font-medium">IMAP port</Label>
              <Input id="add-account-imap-port" type="number" value={imapPort} onChange={(e) => setImapPort(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1">
              <Label htmlFor="add-account-smtp-host" className="text-xs font-medium">SMTP host</Label>
              <Input id="add-account-smtp-host" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="add-account-smtp-port" className="text-xs font-medium">SMTP port</Label>
              <Input id="add-account-smtp-port" type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Adding" : "Add account"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
