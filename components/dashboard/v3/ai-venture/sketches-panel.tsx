"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import { Copy, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BoardWindow } from "@/components/dashboard/v3/whiteboard/BoardWindow"

export type SketchBoard = { id: string; title: string | null; updated_at: string }

export function SketchesPanel({
  boards,
  loading,
  onChanged,
}: {
  boards: SketchBoard[]
  loading: boolean
  onChanged: () => void
}) {
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [deleteAllOpen, setDeleteAllOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const createBoard = async () => {
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled sketch", scope: "ai-venture" }),
      })
      const data = await res.json()
      setOpenId(data.board.id)
      onChanged()
    } catch {
      toast.error("Failed to create sketch")
    }
  }

  const duplicateBoard = async (board: SketchBoard) => {
    try {
      const res = await fetch(`/api/boards/${board.id}`)
      const data = await res.json()
      const res2 = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `${board.title || "Untitled"} (copy)`, scope: "ai-venture" }),
      })
      const created = await res2.json()
      await fetch(`/api/boards/${created.board.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: data.board?.content ?? "{}" }),
      })
      toast.success("Sketch duplicated")
      onChanged()
    } catch {
      toast.error("Failed to duplicate")
    }
  }

  const deleteBoard = async (id: string) => {
    try {
      await fetch(`/api/boards/${id}`, { method: "DELETE" })
      toast.success("Sketch deleted")
      onChanged()
    } catch {
      toast.error("Failed to delete")
    }
  }

  const deleteAll = async () => {
    setBusy(true)
    try {
      await Promise.all(boards.map((b) => fetch(`/api/boards/${b.id}`, { method: "DELETE" })))
      toast.success("All sketches deleted")
      setDeleteAllOpen(false)
      onChanged()
    } catch {
      toast.error("Failed to delete all sketches")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Brainstorm Sketches</h2>
        <div className="flex items-center gap-2">
          {boards.length > 0 && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteAllOpen(true)}>
              Delete all
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={createBoard}>
            <Plus className="size-4" /> New sketch
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-28 animate-pulse bg-muted/20" />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <Card>
          <CardContent className="flex h-32 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <p className="text-sm">No sketches yet.</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={createBoard}>
              <Plus className="size-4" /> New sketch
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <Card
              key={b.id}
              className="group cursor-pointer transition-colors hover:bg-accent/30"
              onClick={() => setOpenId(b.id)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium leading-tight">{b.title || "Untitled"}</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => setOpenId(b.id)}>
                      <Pencil className="mr-2 size-4" /> Open
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicateBoard(b)}>
                      <Copy className="mr-2 size-4" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteBoard(b.id)}>
                      <Trash2 className="mr-2 size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Edited {formatDistanceToNow(new Date(b.updated_at), { addSuffix: true })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BoardWindow
        boardId={openId}
        open={openId !== null}
        onOpenChange={(o) => { if (!o) { setOpenId(null); onChanged() } }}
        onChanged={onChanged}
      />

      <Dialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete all sketches?</DialogTitle>
            <DialogDescription>
              This permanently removes all {boards.length} sketch{boards.length === 1 ? "" : "es"}. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAllOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={deleteAll}>
              <Trash2 className="mr-2 size-4" /> Delete all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
