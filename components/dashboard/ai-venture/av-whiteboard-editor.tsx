"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const ExcalidrawCanvas = dynamic(() => import("@/components/dashboard/v3/whiteboard/Whiteboard"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading canvas…</div>,
})
const BlocksuiteEditor = dynamic(() => import("@/components/dashboard/v3/blocksuite/blocksuite-editor"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading editor…</div>,
})

export type BoardEngine = "excalidraw" | "affine"

export const AFFINE_SECTION = "concepts" // preserves boards created before this rewrite

// Shared by both the Whiteboard tool and Playground — a single editor
// implementation so opening a board from either place uses identical
// load/save logic against the same persistent record.
export function AvWhiteboardEditor({
  engine,
  boardId,
  onBack,
}: {
  engine: BoardEngine
  boardId: string
  onBack: () => void
}) {
  const [title, setTitle] = useState("Untitled")
  const [excalidrawData, setExcalidrawData] = useState<string>("{}")
  const [affineSnapshot, setAffineSnapshot] = useState<Record<string, unknown> | null>(null)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<"loading" | "saving" | "saved">("loading")
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Title edits and content/snapshot edits both flow through saveContent and
  // can land within the same 500ms debounce window (e.g. renaming right
  // after a drawing change). A prior version reset the timer with only the
  // latest call's payload, so the earlier field's change was silently
  // dropped instead of saved. Accumulate into one pending object so every
  // field that changed before the flush actually gets sent.
  const pending = useRef<Record<string, unknown>>({})

  useEffect(() => {
    setReady(false)
    ;(async () => {
      if (engine === "excalidraw") {
        const res = await fetch(`/api/boards/${boardId}`)
        const json = await res.json()
        setExcalidrawData(json.board?.content ?? "{}")
        setTitle(json.board?.title || "Untitled")
      } else {
        const res = await fetch(`/api/affine/${boardId}`)
        const json = await res.json()
        setAffineSnapshot(json.workspace?.snapshot ?? null)
        setTitle(json.workspace?.title || "Untitled")
      }
      setStatus("saved")
      setReady(true)
    })()
  }, [engine, boardId])

  const saveContent = useCallback(
    (payload: Record<string, unknown>) => {
      setStatus("saving")
      pending.current = { ...pending.current, ...payload }
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        const body = pending.current
        pending.current = {}
        try {
          if (engine === "excalidraw") {
            await fetch(`/api/boards/${boardId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            })
          } else {
            await fetch(`/api/affine/${boardId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...body, section: AFFINE_SECTION }),
            })
          }
        } catch {
          // best-effort autosave; the next change retries
        }
        setStatus("saved")
      }, 500)
    },
    [engine, boardId]
  )

  const saveTitle = useCallback(
    (next: string) => {
      setTitle(next)
      saveContent({ title: next })
    },
    [saveContent]
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button size="icon-sm" variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <Input value={title} onChange={(e) => saveTitle(e.target.value)} className="h-8 w-64 text-sm" />
        <span className="text-xs text-muted-foreground">
          {status === "saving" ? "Saving…" : status === "loading" ? "Loading…" : "Saved"}
        </span>
      </div>
      <div className="relative flex-1">
        {!ready ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading board…</div>
        ) : engine === "excalidraw" ? (
          <ExcalidrawCanvas
            key={boardId}
            initialData={excalidrawData}
            onChange={(snapshot: string) => saveContent({ content: snapshot })}
            onMount={() => {}}
          />
        ) : (
          <BlocksuiteEditor
            key={boardId}
            snapshot={affineSnapshot}
            mode="edgeless"
            onChange={(snapshot) => saveContent({ snapshot })}
          />
        )}
      </div>
    </div>
  )
}
