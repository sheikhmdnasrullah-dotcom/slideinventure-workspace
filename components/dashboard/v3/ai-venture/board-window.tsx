"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { ArrowLeft, Loader2, StickyNote, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types"

// Excalidraw touches browser-only APIs.
const Whiteboard = dynamic(() => import("@/components/dashboard/v3/whiteboard/Whiteboard"), { ssr: false })

function viewportCenter(api: ExcalidrawImperativeAPI) {
  const s = api.getAppState()
  const zoom = s.zoom?.value ?? 1
  return {
    x: -s.scrollX + s.width / (2 * zoom),
    y: -s.scrollY + s.height / (2 * zoom),
  }
}

// A near-fullscreen "board window" over the dashboard — same experience for
// any AI-Venture-scoped sketch. Persistence mirrors the standalone Brainstorm
// Sketch page (components/dashboard/v3/brainstorm/BrainstormWorkspace.tsx)
// exactly: same `boards` collection/API, same debounce-then-flush shape —
// just scoped to `scope: "ai-venture"` and shown in a modal instead of a route.
export function BoardWindow({
  boardId,
  open,
  onOpenChange,
  onChanged,
}: {
  boardId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged?: (patch: { title?: string; updated_at?: string }) => void
}) {
  const [title, setTitle] = React.useState("")
  const [content, setContent] = React.useState("{}")
  const [loading, setLoading] = React.useState(true)
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle")
  const [renaming, setRenaming] = React.useState(false)

  const editorRef = React.useRef<ExcalidrawImperativeAPI | null>(null)
  const contentRef = React.useRef("{}")
  const idRef = React.useRef<string | null>(boardId)
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const flushSave = React.useCallback(() => {
    const id = idRef.current
    if (!id) return
    clearTimeout(saveTimer.current)
    fetch(`/api/boards/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: contentRef.current }),
    }).catch(() => {})
  }, [])

  React.useEffect(() => {
    idRef.current = boardId
    if (!open || !boardId) return
    setLoading(true)
    fetch(`/api/boards/${boardId}`)
      .then((res) => res.json())
      .then((data) => {
        setTitle(data.board?.title ?? "Untitled")
        setContent(data.board?.content ?? "{}")
        contentRef.current = data.board?.content ?? "{}"
        setStatus("idle")
      })
      .catch(() => toast.error("Failed to open sketch"))
      .finally(() => setLoading(false))
  }, [boardId, open])

  React.useEffect(() => {
    if (!open) return
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushSave()
    }
    window.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("beforeunload", flushSave)
    return () => {
      window.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("beforeunload", flushSave)
      flushSave()
    }
  }, [open, flushSave])

  const handleContentChange = React.useCallback(
    (next: string) => {
      contentRef.current = next
      setStatus("saving")
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        const id = idRef.current
        if (!id) return
        fetch(`/api/boards/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: next }),
        })
          .then(() => {
            setStatus("saved")
            onChanged?.({ updated_at: new Date().toISOString() })
          })
          .catch(() => {
            setStatus("idle")
            toast.error("Couldn't save your latest changes")
          })
      }, 600)
    },
    [onChanged]
  )

  const commitRename = async (value: string) => {
    const clean = value.trim() || "Untitled"
    setTitle(clean)
    setRenaming(false)
    const id = idRef.current
    if (!id) return
    try {
      await fetch(`/api/boards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: clean }),
      })
      onChanged?.({ title: clean })
    } catch {
      toast.error("Failed to rename")
    }
  }

  const handleStickyNote = async () => {
    const api = editorRef.current
    if (!api) return
    const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw")
    const center = viewportCenter(api)
    const elements = convertToExcalidrawElements([
      {
        type: "rectangle",
        x: center.x - 90,
        y: center.y - 90,
        width: 180,
        height: 180,
        backgroundColor: "#fff3bf",
        strokeColor: "#f1c40f",
        label: { text: "" },
      },
    ])
    api.updateScene({
      elements: [...api.getSceneElements(), ...elements],
      appState: { selectedElementIds: { [elements[0].id]: true } },
    })
  }

  const handleClose = () => {
    flushSave()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-[97vw] max-w-[1400px] flex-col overflow-hidden p-0" showCloseButton={false}>
        <div className="flex items-center gap-3 border-b bg-background px-4 py-2.5">
          <Button variant="ghost" size="icon-sm" onClick={handleClose} aria-label="Back to AI Venture">
            <ArrowLeft className="size-4" />
          </Button>
          {renaming ? (
            <Input
              autoFocus
              defaultValue={title}
              onBlur={(e) => commitRename(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename(e.currentTarget.value)
                if (e.key === "Escape") setRenaming(false)
              }}
              className="h-8 max-w-xs text-sm font-semibold"
            />
          ) : (
            <button
              onClick={() => setRenaming(true)}
              className="truncate text-sm font-semibold hover:underline"
              title="Rename"
            >
              {title || "Untitled"}
            </button>
          )}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {status === "saving" && <Loader2 className="size-3 animate-spin" />}
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-1.5"
            onClick={handleStickyNote}
            title="Add a sticky note"
          >
            <StickyNote className="size-4" /> Sticky note
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={handleClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="relative min-h-0 flex-1">
          {loading ? (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Opening sketch…
            </div>
          ) : (
            <Whiteboard
              key={boardId ?? "none"}
              initialData={content}
              onChange={handleContentChange}
              onMount={(api: ExcalidrawImperativeAPI) => {
                editorRef.current = api
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
