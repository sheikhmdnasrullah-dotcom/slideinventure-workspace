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
import { useAIVenture, type VentureNode } from "./use-ai-venture"

export function RenameDialog({
  node,
  open,
  onOpenChange,
}: {
  node: VentureNode | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { renameEntry } = useAIVenture()
  const [name, setName] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open && node) setName(node.name)
  }, [open, node])

  const handleRename = async () => {
    if (!node) return
    const trimmed = name.trim()
    if (!trimmed || trimmed === node.name) {
      onOpenChange(false)
      return
    }
    setSaving(true)
    try {
      await renameEntry(node, trimmed)
      toast.success("Renamed")
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to rename")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {node?.type}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <Label>Name</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename()
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleRename} disabled={!name.trim() || saving}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
