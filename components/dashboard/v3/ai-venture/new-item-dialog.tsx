"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { useAIVenture } from "./use-ai-venture"

export function NewItemDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { createEntry } = useAIVenture()
  const [name, setName] = React.useState("")
  const [type, setType] = React.useState<"file" | "folder">("file")
  const [ext, setExt] = React.useState<"md" | "txt">("md")
  const [brainstormTarget, setBrainstormTarget] = React.useState<"brainstorm" | "brainstorm-sketches">("brainstorm")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName("")
      setType("file")
      setExt("md")
      setBrainstormTarget("brainstorm")
    }
  }, [open])

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const finalName = type === "file" && !trimmed.includes(".") ? `${trimmed}.${ext}` : trimmed
    setSaving(true)
    try {
      if (type === "folder") {
        const folderName = brainstormTarget === "brainstorm-sketches" ? "Brainstorm Sketches" : "Brainstorm"
        await createEntry(finalName, "folder")
        // Navigate into the new folder
        await new Promise(resolve => setTimeout(resolve, 100))
        onOpenChange(false)
      } else {
        await createEntry(finalName, type)
        onOpenChange(false)
      }
      toast.success(`${type === "folder" ? "Folder" : "File"} created`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New {type === "file" ? "file" : "folder"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "file" | "folder")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="file">File</SelectItem>
                <SelectItem value="folder">Folder</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "folder" && (
            <div className="flex flex-col gap-2">
              <Label>Brainstorm Target</Label>
              <Select value={brainstormTarget} onValueChange={(v) => setBrainstormTarget(v as "brainstorm" | "brainstorm-sketches")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brainstorm">Brainstorm</SelectItem>
                  <SelectItem value="brainstorm-sketches">Brainstorm Sketches</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {type === "file" && (
            <div className="flex flex-col gap-2">
              <Label>Extension</Label>
              <Select value={ext} onValueChange={(v) => setExt(v as "md" | "txt")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="md">.md</SelectItem>
                  <SelectItem value="txt">.txt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label>Name</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === "file" ? "notes" : "research"}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate()
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || saving}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
