"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FlaskConical, Plus, Trash2, PenTool, Network, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useLiveRefresh } from "@/components/providers/event-stream"
import { AppWindow } from "./app-window"
import { AvWhiteboardEditor, type BoardEngine } from "./av-whiteboard-editor"
import { IdeaMapCanvas } from "@/components/dashboard/ideas/idea-map-canvas"

const SCOPE = "research"

type Thread = {
  id: string
  title: string
  description: string
  sources: string
  excelBoardId?: string
  affineWorkspaceId?: string
}

type ThreadSummary = { id: string; title: string }

// Capture-first research threads. The data model and endpoints are exactly the
// ones research-lab-workspace uses (boards with scope "research"): no new
// collection, no scoring, no rankings, no validators. A thread is just a title,
// a free notes area, and a free sources area you can dump and revisit.
export function AvResearch() {
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [active, setActive] = useState<Thread | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [boardPopup, setBoardPopup] = useState<{ engine: BoardEngine; id: string } | null>(null)
  const [mapPopup, setMapPopup] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<Thread | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/boards?scope=${SCOPE}`)
      if (!res.ok) throw new Error("Could not load research threads")
      const json = await res.json()
      setThreads((json.boards ?? []).map((b: any) => ({ id: b.id, title: b.title || "Untitled" })))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load research threads")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Threads are boards (scope "research"); their writes land in the activity
  // feed under the "knowledge" source, so refresh when those events arrive.
  useLiveRefresh(load, { sources: ["knowledge"] })

  const flushSave = useCallback(async () => {
    const t = pendingRef.current
    if (!t || !t.id) return
    pendingRef.current = null
    try {
      const res = await fetch(`/api/boards/${t.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t.title,
          content: JSON.stringify({
            description: t.description,
            sources: t.sources,
            excelBoardId: t.excelBoardId,
            affineWorkspaceId: t.affineWorkspaceId,
          }),
          scope: SCOPE,
        }),
      })
      if (!res.ok) throw new Error()
      setSaveState("saved")
    } catch {
      setSaveState("error")
      toast.error("Could not save thread")
    }
  }, [])

  const scheduleSave = (t: Thread) => {
    pendingRef.current = t
    setSaveState("saving")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void flushSave(), 600)
  }

  // Flush any pending edit when leaving the section so switching tabs never
  // loses text. Fire-and-forget: we cannot await in cleanup.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      const t = pendingRef.current
      if (t && t.id) {
        const body = JSON.stringify({
          title: t.title,
          content: JSON.stringify({
            description: t.description,
            sources: t.sources,
            excelBoardId: t.excelBoardId,
            affineWorkspaceId: t.affineWorkspaceId,
          }),
          scope: SCOPE,
        })
        fetch(`/api/boards/${t.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body,
        }).catch(() => {})
      }
    }
  }, [])

  const selectThread = async (id: string) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      await flushSave()
    }
    try {
      const res = await fetch(`/api/boards/${id}`)
      const json = await res.json()
      const content = json.board?.content ? JSON.parse(json.board.content || "{}") : {}
      setActive({
        id,
        title: json.board?.title || "Untitled",
        description: content.description || "",
        sources: content.sources || "",
        excelBoardId: content.excelBoardId,
        affineWorkspaceId: content.affineWorkspaceId,
      })
      setSaveState("idle")
    } catch {
      toast.error("Could not open thread")
    }
  }

  const createThread = async () => {
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New research thread",
          scope: SCOPE,
          content: JSON.stringify({ description: "", sources: "" }),
        }),
      })
      const json = await res.json()
      if (json.board) {
        setThreads((prev) => [{ id: json.board.id, title: json.board.title || "Untitled" }, ...prev])
        await selectThread(json.board.id)
      }
    } catch {
      toast.error("Could not create thread")
    }
  }

  const renameThread = async (id: string, value: string) => {
    const next = value.trim() || "Untitled"
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title: next } : t)))
    if (active?.id === id) setActive({ ...active, title: next })
    try {
      await fetch(`/api/boards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      })
    } catch {
      toast.error("Could not rename thread")
      load()
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    const id = deleteId
    setDeleteId(null)
    setThreads((prev) => prev.filter((t) => t.id !== id))
    if (active?.id === id) setActive(null)
    try {
      const res = await fetch(`/api/boards/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Thread deleted")
    } catch {
      toast.error("Could not delete thread")
      load()
    }
  }

  const update = (patch: Partial<Thread>) => {
    if (!active) return
    const next = { ...active, ...patch }
    setActive(next)
    if (patch.title !== undefined) {
      setThreads((prev) => prev.map((t) => (t.id === next.id ? { ...t, title: next.title } : t)))
    }
    scheduleSave(next)
  }

  const openBoard = async () => {
    if (!active) return
    let id = active.excelBoardId
    if (!id) {
      try {
        const res = await fetch("/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: `${active.title}: Sketch`, scope: "ai-venture" }),
        })
        const json = await res.json()
        id = json.board?.id
        if (id) {
          const next = { ...active, excelBoardId: id }
          setActive(next)
          pendingRef.current = next
          await flushSave()
        }
      } catch {
        toast.error("Could not create a board")
        return
      }
    }
    if (id) setBoardPopup({ engine: "excalidraw", id })
  }

  const openIdeaMap = async () => {
    if (!active) return
    try {
      const res = await fetch("/api/idea-maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `${active.title}: Idea map` }),
      })
      const json = await res.json()
      if (json.map?.id) setMapPopup(json.map.id)
    } catch {
      toast.error("Could not create an idea map")
    }
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-border bg-card/40 p-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Threads
          </span>
          <Button size="xs" variant="outline" onClick={createThread}>
            <Plus className="size-3" /> New
          </Button>
        </div>
        <ScrollArea className="flex-1" data-lenis-prevent>
          {loading ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Loading</p>
          ) : error ? (
            <div className="flex flex-col gap-2 px-2 py-3">
              <p className="text-xs text-destructive">{error}</p>
              <Button size="xs" variant="outline" onClick={load}>
                Retry
              </Button>
            </div>
          ) : threads.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No threads yet. Capture one.</p>
          ) : (
            threads.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-2 py-2 text-left text-sm hover:bg-accent",
                  active?.id === t.id && "bg-accent"
                )}
              >
                <button
                  onClick={() => selectThread(t.id)}
                  className="flex-1 truncate text-left"
                >
                  {t.title}
                </button>
                <button
                  aria-label="Rename"
                  onClick={() => {
                    const v = window.prompt("Rename thread", t.title)
                    if (v !== null) renameThread(t.id, v)
                  }}
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                >
                  <FlaskConical className="size-3.5" />
                </button>
                <button
                  aria-label="Delete"
                  onClick={() => setDeleteId(t.id)}
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </ScrollArea>
      </aside>

      <main className="flex-1 overflow-y-auto p-6" data-lenis-prevent>
        {!active ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <p className="text-sm">Create or open a research thread to capture notes and sources.</p>
            <Button onClick={createThread}>
              <Plus className="size-4" /> New research thread
            </Button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            <div className="flex items-center gap-2">
              <Input
                value={active.title}
                onChange={(e) => update({ title: e.target.value })}
                onBlur={() => renameThread(active.id, active.title)}
                className="h-9 text-base font-medium"
              />
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                {saveState === "saving" && <Loader2 className="size-3 animate-spin" />}
                {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : ""}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea
                value={active.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="What are you researching? Hypotheses, key questions, working thoughts"
                rows={8}
                className="resize-y"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Sources</label>
              <Textarea
                value={active.sources}
                onChange={(e) => update({ sources: e.target.value })}
                placeholder="Links, references, raw material for this thread"
                rows={5}
                className="resize-y"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={openBoard}>
                <PenTool className="size-3.5" /> Open sketch board
              </Button>
              <Button variant="outline" onClick={openIdeaMap}>
                <Network className="size-3.5" /> Open idea map
              </Button>
            </div>
          </div>
        )}
      </main>

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete thread</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the thread and its saved notes. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              <X className="size-3" /> Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="size-3" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppWindow open={!!boardPopup} onClose={() => setBoardPopup(null)} title="Sketch board">
        {boardPopup && (
          <AvWhiteboardEditor
            engine={boardPopup.engine}
            boardId={boardPopup.id}
            onBack={() => setBoardPopup(null)}
          />
        )}
      </AppWindow>

      <AppWindow open={!!mapPopup} onClose={() => setMapPopup(null)} title="Idea map">
        {mapPopup && <IdeaMapCanvas mapId={mapPopup} className="h-full w-full" />}
      </AppWindow>
    </div>
  )
}
