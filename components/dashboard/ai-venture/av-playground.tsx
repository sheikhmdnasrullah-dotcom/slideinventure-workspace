"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, PenTool, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AvWhiteboardEditor, AFFINE_SECTION, type BoardEngine } from "./av-whiteboard-editor"

type Engine = BoardEngine
type PlaygroundItem = { id: string; engine: Engine; title: string; updated_at: string }

// A view over the SAME persistent boards Whiteboard already writes to — no
// separate storage, just a combined listing across both engines.
async function loadAll(): Promise<PlaygroundItem[]> {
  const [boardsRes, affineRes] = await Promise.all([
    fetch("/api/boards?scope=ai-venture").then((r) => r.json()).catch(() => ({ boards: [] })),
    fetch(`/api/affine?section=${AFFINE_SECTION}`).then((r) => r.json()).catch(() => ({ workspaces: [] })),
  ])
  const excalidraw: PlaygroundItem[] = (boardsRes.boards ?? []).map((b: any) => ({
    id: b.id,
    engine: "excalidraw" as const,
    title: b.title || "Untitled",
    updated_at: b.updated_at,
  }))
  const affine: PlaygroundItem[] = (affineRes.workspaces ?? []).map((w: any) => ({
    id: w.id,
    engine: "affine" as const,
    title: w.title || "Untitled",
    updated_at: w.updated_at,
  }))
  return [...excalidraw, ...affine].sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))
}

export function AvPlayground() {
  const [items, setItems] = useState<PlaygroundItem[]>([])
  const [loading, setLoading] = useState(true)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [open, setOpen] = useState<PlaygroundItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setItems(await loadAll())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (open) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Button size="icon-sm" variant="ghost" onClick={() => { setOpen(null); load(); }}>
            <ArrowLeft className="size-4" />
          </Button>
          <span className="text-xs text-muted-foreground">Playground · {open.engine}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <AvWhiteboardEditor engine={open.engine} boardId={open.id} onBack={() => { setOpen(null); load(); }} />
        </div>
      </div>
    )
  }

  const rename = async (item: PlaygroundItem) => {
    const endpoint = item.engine === "excalidraw" ? `/api/boards/${item.id}` : `/api/affine/${item.id}`
    const body = item.engine === "excalidraw" ? { title: renameValue } : { title: renameValue, section: AFFINE_SECTION }
    await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    setRenamingId(null)
    load()
  }

  const remove = async (item: PlaygroundItem) => {
    const endpoint =
      item.engine === "excalidraw" ? `/api/boards/${item.id}` : `/api/affine/${item.id}?section=${AFFINE_SECTION}`
    await fetch(endpoint, { method: "DELETE" })
    setItems((prev) => prev.filter((i) => i.id !== item.id))
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div>
        <h2 className="text-sm font-medium">Playground</h2>
        <p className="text-xs text-muted-foreground">Every whiteboard you've made, in one library — nothing duplicated, just a view onto your boards.</p>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
          <PenTool className="size-8" />
          <p className="text-sm">Nothing here yet — drawings you save in Whiteboard show up here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div key={`${item.engine}-${item.id}`} className="group relative flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-sm">
              <button onClick={() => setOpen(item)} className="flex flex-col items-center gap-2">
                <PenTool className="size-8 text-muted-foreground" />
                {renamingId === item.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => rename(item)}
                    onKeyDown={(e) => e.key === "Enter" && rename(item)}
                    className="w-full rounded border border-input bg-transparent px-1 text-center text-xs outline-none"
                  />
                ) : (
                  <span className="line-clamp-1 text-center">{item.title}</span>
                )}
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.engine}</span>
              </button>
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100">
                <button
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation()
                    setRenamingId(item.id)
                    setRenameValue(item.title)
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <span className="text-xs">✎</span>
                </button>
                <Trash2
                  className="size-3.5 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(item)
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
