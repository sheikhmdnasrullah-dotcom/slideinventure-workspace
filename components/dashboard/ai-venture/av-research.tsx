"use client"

import { useCallback, useEffect, useState } from "react"
import { useQueryState } from "nuqs"
import { FlaskConical, NotebookPen, PenTool, FolderOpen, Bot, Trash2, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { useLiveRefresh } from "@/components/providers/event-stream"
import { formatDistanceToNow } from "date-fns"

type ResearchLabSource = "notepad" | "brainstorm" | "files" | "agent"

type ResearchLabItem = {
  id: string
  source: ResearchLabSource
  sourceRef: string
  title: string
  summary: string
  reference: Record<string, string> | null
  createdAt: string
  updatedAt: string
}

const SOURCE_META: Record<ResearchLabSource, { label: string; icon: typeof NotebookPen }> = {
  notepad: { label: "From Notepad", icon: NotebookPen },
  brainstorm: { label: "From Brainstorm", icon: PenTool },
  files: { label: "From Files", icon: FolderOpen },
  agent: { label: "From Agents", icon: Bot },
}

const SOURCE_ORDER: ResearchLabSource[] = ["notepad", "brainstorm", "files", "agent"]

// Research Lab is a read-only, auto-organized canvas: it never takes typed
// input directly. Notepad, Brainstorm, Files, and Agents each write their
// core idea here as it happens (see lib/research-lab/capture.ts), grouped by
// source instead of scattered in one flat list. "Open source" jumps back to
// wherever the idea came from via the shared ?tab= URL state.
export function AvResearch() {
  const [, setTab] = useQueryState("tab")
  const [, setNotePath] = useQueryState("note")
  const [, setBoardPath] = useQueryState("board")
  const [, setBoardEngine] = useQueryState("boardEngine")
  const [, setFilePath] = useQueryState("path")

  const [items, setItems] = useState<ResearchLabItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/research-lab/items")
      if (!res.ok) throw new Error("Could not load the Research Lab")
      const json = await res.json()
      setItems(json.items ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the Research Lab")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useLiveRefresh(load, { sources: ["research-lab"] })

  const openSource = (item: ResearchLabItem) => {
    const ref = item.reference
    if (!ref?.tab) return
    void setTab(ref.tab)
    if (ref.tab === "notepad" && ref.note) void setNotePath(ref.note)
    if (ref.tab === "brainstorm" && ref.board) {
      void setBoardPath(ref.board)
      void setBoardEngine(ref.engine || "excalidraw")
    }
    if (ref.tab === "files" && ref.path) void setFilePath(ref.path)
  }

  const remove = async (id: string) => {
    setDeletingId(id)
    const prev = items
    setItems((cur) => cur.filter((i) => i.id !== id))
    try {
      const res = await fetch(`/api/research-lab/items/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
    } catch {
      setItems(prev)
      toast.error("Could not remove this item")
    } finally {
      setDeletingId(null)
    }
  }

  const grouped = SOURCE_ORDER.map((source) => ({
    source,
    items: items.filter((i) => i.source === source),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Research Lab</h2>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The core idea of everything you write, sketch, upload, or run gets organized here
          automatically — nothing to type. Write in Notepad, sketch in Brainstorm, add a file, or run
          an agent, and it shows up below.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={load}>
            Retry
          </Button>
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
          <FlaskConical className="size-10 opacity-30" />
          <p className="text-sm font-medium text-ink-strong">Nothing here yet</p>
          <p className="max-w-sm text-xs">
            This canvas fills itself in: write in Notepad, sketch in Brainstorm, add a file, or run an
            agent — the core idea shows up here automatically, organized by where it came from.
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1" data-lenis-prevent>
          <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
            {grouped.map(({ source, items: sourceItems }) => {
              const meta = SOURCE_META[source]
              const Icon = meta.icon
              return (
                <section key={source} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Icon className="size-3.5" />
                    {meta.label}
                  </div>
                  <div className="flex flex-col gap-2">
                    {sourceItems.map((item) => (
                      <div
                        key={item.id}
                        className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-tight">{item.title}</p>
                          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {item.reference?.tab && (
                              <button
                                onClick={() => openSource(item)}
                                title="Open source"
                                className="rounded p-1 text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink className="size-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => remove(item.id)}
                              disabled={deletingId === item.id}
                              title="Remove"
                              className="rounded p-1 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="whitespace-pre-line text-sm text-muted-foreground">
                          {item.summary}
                        </div>
                        <p className="text-[11px] text-muted-foreground/70">
                          {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
