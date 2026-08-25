"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const Whiteboard = dynamic(() => import("@/components/dashboard/v3/whiteboard/dynamic"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-muted-foreground">Loading canvas…</div>,
})

type Board = { id: string; title: string | null; content: string; updated_at: string }

export default function BrainstormSketchPage() {
  const [boards, setBoards] = React.useState<Board[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [content, setContent] = React.useState<string>("{}")
  const [title, setTitle] = React.useState<string>("")
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle")
  const saveTimer = React.useRef<ReturnType<typeof setTimeout>>()

  const loadBoards = React.useCallback(async () => {
    try {
      const res = await fetch("/api/boards")
      const data = await res.json()
      const list = (data.boards ?? []) as Board[]
      setBoards(list)
      if (list.length > 0) {
        selectBoard(list[0])
      }
    } catch {
      toast.error("Failed to load boards")
    }
  }, [])

  React.useEffect(() => {
    loadBoards()
  }, [loadBoards])

  const selectBoard = async (board: Board) => {
    setSelectedId(board.id)
    setTitle(board.title ?? "")
    try {
      const res = await fetch(`/api/boards/${board.id}`)
      const data = await res.json()
      setContent(data.board?.content ?? "{}")
    } catch {
      setContent("{}")
    }
    setStatus("idle")
  }

  const persist = React.useCallback(
    (id: string, nextContent: string) => {
      setStatus("saving")
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        try {
          await fetch(`/api/boards/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: nextContent, title: title || "Untitled board" }),
          })
          setStatus("saved")
        } catch {
          toast.error("Failed to save board")
          setStatus("idle")
        }
      }, 800)
    },
    [title]
  )

  const handleNew = async () => {
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled board" }),
      })
      const data = await res.json()
      const board = data.board as Board
      setBoards((prev) => [board, ...prev])
      selectBoard(board)
    } catch {
      toast.error("Failed to create board")
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold">Brainstorm Sketch</h1>
          <p className="text-sm text-muted-foreground">Infinite canvas. Draw, then it autosaves.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {status === "saving" && <Loader2 className="size-3 animate-spin" />}
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
          </span>
          <Button onClick={handleNew} className="gap-2">
            <Plus className="size-4" /> New Board
          </Button>
        </div>
      </div>
      <Separator />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-60 shrink-0 border-r">
          <div className="flex flex-col gap-1 p-3">
            {boards.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No boards yet. Click “New Board”.</div>
            ) : (
              boards.map((b) => (
                <button
                  key={b.id}
                  onClick={() => selectBoard(b)}
                  className={`rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent/20 ${selectedId === b.id ? "bg-muted" : ""}`}
                >
                  <span className="block truncate font-medium">{b.title || "Untitled board"}</span>
                </button>
              ))
            )}
          </div>
        </aside>
        <section className="relative flex-1">
          {selectedId ? (
            <Whiteboard initialData={content} onChange={(c: string) => persist(selectedId, c)} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Create a board to start sketching.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
