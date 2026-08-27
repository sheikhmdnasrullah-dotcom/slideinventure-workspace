"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, PenTool, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AFFINE_SECTION, type BoardEngine } from "./av-whiteboard-editor"
import { AppFrameDialog } from "@/components/dashboard/v3/app-frame-dialog"

type BoardSummary = { id: string; title: string; updated_at: string }

async function listBoards(engine: BoardEngine): Promise<BoardSummary[]> {
  if (engine === "excalidraw") {
    const res = await fetch("/api/boards?scope=ai-venture")
    const json = await res.json()
    return (json.boards ?? []).map((b: any) => ({ id: b.id, title: b.title || "Untitled", updated_at: b.updated_at }))
  }
  const res = await fetch(`/api/affine?section=${AFFINE_SECTION}`)
  const json = await res.json()
  return (json.workspaces ?? []).map((w: any) => ({ id: w.id, title: w.title || "Untitled", updated_at: w.updated_at }))
}

async function createBoard(engine: BoardEngine, title: string): Promise<string> {
  if (engine === "excalidraw") {
    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, scope: "ai-venture" }),
    })
    const json = await res.json()
    return json.board.id
  }
  const res = await fetch("/api/affine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section: AFFINE_SECTION, title }),
  })
  const json = await res.json()
  return json.workspace.id
}

async function deleteBoard(engine: BoardEngine, id: string) {
  if (engine === "excalidraw") {
    await fetch(`/api/boards/${id}`, { method: "DELETE" })
  } else {
    await fetch(`/api/affine/${id}?section=${AFFINE_SECTION}`, { method: "DELETE" })
  }
}

function BoardList({ engine, onOpen }: { engine: BoardEngine; onOpen: (id: string) => void }) {
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setBoards(await listBoards(engine))
    setLoading(false)
  }, [engine])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    const id = await createBoard(engine, "Untitled")
    onOpen(id)
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteBoard(engine, id)
    setBoards((prev) => prev.filter((b) => b.id !== id))
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium capitalize">{engine} boards</span>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="size-3.5" /> New board
        </Button>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading</p>
      ) : boards.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
          <PenTool className="size-8" />
          <p className="text-sm">No {engine} boards yet. Create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
          {boards.map((b) => (
            <button
              key={b.id}
              onClick={() => onOpen(b.id)}
              className="group relative flex flex-col items-center justify-center gap-2 rounded-xl border border-border p-4 text-sm hover:bg-accent"
            >
              <PenTool className="size-8 text-muted-foreground" />
              <span className="line-clamp-1 text-center">{b.title}</span>
              <Trash2
                className="absolute right-2 top-2 size-3.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                onClick={(e) => handleDelete(b.id, e)}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function AvWhiteboard() {
  const [engine, setEngine] = useState<BoardEngine | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  if (activeId && engine) {
    const frameUrl =
      engine === "excalidraw"
        ? `/excalidraw?scope=ai-venture&id=${encodeURIComponent(activeId)}`
        : `/whiteboard?section=${AFFINE_SECTION}&id=${encodeURIComponent(activeId)}`
    return (
      <AppFrameDialog
        url={frameUrl}
        title={`${engine} board`}
        onClose={() => setActiveId(null)}
      />
    )
  }

  if (engine) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Button size="icon-sm" variant="ghost" onClick={() => setEngine(null)}>
            <ArrowLeft className="size-4" />
          </Button>
          <span className="text-xs text-muted-foreground">Engine: {engine}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <BoardList engine={engine} onOpen={setActiveId} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h2 className="text-lg font-medium">Choose a whiteboard engine</h2>
        <p className="text-sm text-muted-foreground">Both save automatically and stay right here in AI Venture.</p>
      </div>
      <div className="flex gap-4">
        {(["excalidraw", "affine"] as BoardEngine[]).map((e) => (
          <button
            key={e}
            onClick={() => setEngine(e)}
            className={cn(
              "flex w-48 flex-col items-center gap-3 rounded-xl border border-border p-6 hover:bg-accent hover:shadow-sm transition-all"
            )}
          >
            <PenTool className="size-10 text-muted-foreground" />
            <span className="text-sm font-medium capitalize">{e}</span>
            <span className="text-xs text-muted-foreground">
              {e === "excalidraw" ? "Hand-drawn style sketching" : "AFFiNE-style block canvas"}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
