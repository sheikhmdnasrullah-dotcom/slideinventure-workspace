"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { ArrowLeft, Download, FileJson, FileType2, Image as ImageIcon, Loader2, StickyNote, X } from "lucide-react"
import { toast } from "sonner"
import { jsPDF } from "jspdf"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types"
import { CanvasErrorBoundary } from "./CanvasErrorBoundary"

// Excalidraw touches browser-only APIs.
const Whiteboard = dynamic(() => import("./Whiteboard"), { ssr: false })

function viewportCenter(api: ExcalidrawImperativeAPI) {
  const s = api.getAppState()
  const zoom = s.zoom?.value ?? 1
  return {
    x: -s.scrollX + s.width / (2 * zoom),
    y: -s.scrollY + s.height / (2 * zoom),
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("read error"))
    reader.readAsDataURL(blob)
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

// The single near-fullscreen "board window" used everywhere a sketch is
// opened for editing — standalone Brainstorm Sketch and AI Venture's
// Sketches both use this, instead of each keeping their own inline canvas
// section/duplicate autosave logic. Same `boards` collection/API either way;
// callers just pass the id and a scope-appropriate onChanged handler.
export function BoardWindow({
  boardId,
  open,
  onOpenChange,
  onChanged,
  backLabel = "Back",
}: {
  boardId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged?: (patch: { title?: string; updated_at?: string }) => void
  backLabel?: string
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
    const { convertToExcalidrawElements, CaptureUpdateAction } = await import("@excalidraw/excalidraw")
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
    // captureUpdate is required here — an "EVENTUALLY" (the default) update
    // renders but never reaches onChange/autosave until a later user edit
    // commits it, so the note could silently vanish on refresh.
    api.updateScene({
      elements: [...api.getSceneElements(), ...elements],
      appState: { selectedElementIds: { [elements[0].id]: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    })
  }

  const handleExport = async (format: "png" | "json" | "pdf") => {
    const api = editorRef.current
    if (!api) {
      toast.error("Canvas isn't ready yet")
      return
    }
    const safeName = (title || "brainstorm").replace(/[^a-z0-9-_]+/gi, "_").toLowerCase()
    try {
      const elements = api.getSceneElements()
      const appState = api.getAppState()

      if (format === "json") {
        const snapshot = JSON.stringify({
          elements,
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor,
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
            zoom: appState.zoom,
          },
        })
        downloadBlob(new Blob([snapshot], { type: "application/json" }), `${safeName}.json`)
        return
      }

      if (elements.length === 0) {
        toast.error("Nothing drawn yet to export")
        return
      }
      const { exportToBlob } = await import("@excalidraw/excalidraw")
      const blob = await exportToBlob({ elements, appState, files: api.getFiles(), mimeType: "image/png" })
      if (format === "png") {
        downloadBlob(blob, `${safeName}.png`)
        return
      }
      const dataUrl = await blobToDataUrl(blob)
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Could not render image"))
        img.src = dataUrl
      })
      const pdf = new jsPDF({ orientation: img.width >= img.height ? "landscape" : "portrait" })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const ratio = Math.min(pageW / img.width, pageH / img.height)
      const w = img.width * ratio
      const h = img.height * ratio
      pdf.addImage(dataUrl, "PNG", (pageW - w) / 2, (pageH - h) / 2, w, h)
      pdf.save(`${safeName}.pdf`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed")
    }
  }

  const handleClose = () => {
    flushSave()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-[97vw] max-w-[1400px] flex-col overflow-hidden p-0" showCloseButton={false}>
        <div className="flex items-center gap-3 border-b bg-background px-4 py-2.5">
          <Button variant="ghost" size="icon-sm" onClick={handleClose} aria-label={backLabel}>
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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Export">
                  <Download className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("png")}>
                <ImageIcon className="mr-2 size-4" /> Export PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf")}>
                <FileType2 className="mr-2 size-4" /> Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("json")}>
                <FileJson className="mr-2 size-4" /> Export JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            <CanvasErrorBoundary onBack={handleClose}>
              <Whiteboard
                key={boardId ?? "none"}
                initialData={content}
                onChange={handleContentChange}
                onMount={(api: ExcalidrawImperativeAPI) => {
                  editorRef.current = api
                }}
              />
            </CanvasErrorBoundary>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
