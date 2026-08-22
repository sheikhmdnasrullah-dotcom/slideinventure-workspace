"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Copy, Save, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type CommandFormValues = {
  id?: string
  title: string
  command: string
  description: string
  category: string
  tags: string[]
  notes: string
  variables: Record<string, string>
  favorite: boolean
}

const emptyForm: CommandFormValues = {
  title: "",
  command: "",
  description: "",
  category: "",
  tags: [],
  notes: "",
  variables: {},
  favorite: false,
}

interface AddCommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  editingCommand?: CommandFormValues & { id: string } | null
}

export function AddCommandDialog({ open, onOpenChange, onSaved, editingCommand }: AddCommandDialogProps) {
  const [form, setForm] = useState<CommandFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (editingCommand) {
        setForm({
          id: editingCommand.id,
          title: editingCommand.title,
          command: editingCommand.command,
          description: editingCommand.description ?? "",
          category: editingCommand.category ?? "",
          tags: editingCommand.tags ?? [],
          notes: editingCommand.notes ?? "",
          variables: editingCommand.variables ?? {},
          favorite: editingCommand.favorite ?? false,
        })
      } else {
        setForm(emptyForm)
      }
    }
  }, [open, editingCommand])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        tags: (form.tags ?? []).filter(Boolean),
        variables: Object.fromEntries(
          Object.entries(form.variables ?? {}).filter(([, v]) => v.trim() !== "")
        ),
      }

      const url = editingCommand ? `/api/terminal/${editingCommand.id}` : "/api/terminal"
      const method = editingCommand ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error?.message || (editingCommand ? "Failed to update command" : "Failed to add command"))
        return
      }

      toast.success(editingCommand ? "Command updated" : "Command added")
      onSaved()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  const tagsString = (form.tags ?? []).join(", ")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editingCommand ? "Edit Command" : "Add Command"}</SheetTitle>
          <SheetDescription>
            {editingCommand ? "Update your terminal command details." : "Save a reusable terminal command."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Check Port 25"
              required
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Command</Label>
            <Textarea
              value={form.command}
              onChange={(e) => setForm({ ...form, command: e.target.value })}
              placeholder="nc -vz example.com 25"
              required
              className="font-mono text-xs"
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does this command do?"
              className="text-xs"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. network, docker, git"
                className="h-9"
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
                placeholder="quick, prod, ssl"
                className="h-9"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any extra context or warnings..."
              className="text-xs"
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Variables (JSON)</Label>
            <Textarea
              value={JSON.stringify(form.variables ?? {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  setForm({ ...form, variables: parsed })
                } catch {
                  // ignore parse errors while typing
                }
              }}
              placeholder='{"host": "example.com", "port": "25"}'
              className="font-mono text-xs"
              rows={3}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex flex-col">
              <Label className="text-xs font-medium">Favorite</Label>
              <span className="text-xs text-muted-foreground">Show in favorites first</span>
            </div>
            <Switch
              checked={form.favorite}
              onCheckedChange={(checked) => setForm({ ...form, favorite: checked })}
            />
          </div>
          <SheetFooter className="px-0">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              {editingCommand ? "Update Command" : "Save Command"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
