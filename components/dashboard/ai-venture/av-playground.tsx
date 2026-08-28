"use client"

import { useCallback, useEffect, useState } from "react"
import { PenTool, Trash2 } from "lucide-react"
import { AFFINE_SECTION, type BoardEngine } from "./av-whiteboard-editor"
import { AppFrameDialog } from "@/components/dashboard/v3/app-frame-dialog"
import { LUCIDCHART_URL } from "@/lib/lucidchart"

type Engine = BoardEngine
type PlaygroundItem = { id: string; engine: Engine; title: string; updated_at: string }

// A view over the SAME persistent boards Whiteboard already writes to: no
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
    const frameUrl =
      open.engine === "excalidraw"
        ? `/excalidraw?scope=ai-venture&id=${encodeURIComponent(open.id)}`
        : `/whiteboard?section=${AFFINE_SECTION}&id=${encodeURIComponent(open.id)}`
    return (
      <AppFrameDialog
        url={frameUrl}
        title={`Playground · ${open.engine}`}
        onClose={() => {
          setOpen(null)
          load()
        }}
      />
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
        <p className="text-xs text-muted-foreground">Every whiteboard you've made, in one library: nothing duplicated, just a view onto your boards.</p>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading</p>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
          <PenTool className="size-8" />
          <p className="text-sm">Nothing here yet. Drawings you save in Whiteboard show up here.</p>
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
                  <PenTool className="size-3.5" />
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
          <a
            href={LUCIDCHART_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex flex-col items-center gap-2 rounded-xl border border-dashed p-4 text-sm hover:bg-accent"
          >
            <PenTool className="size-8 text-muted-foreground" />
            <span className="line-clamp-1 text-center">Lucidchart</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">charts</span>
          </a>
        </div>
      )}
    </div>
  )
}
