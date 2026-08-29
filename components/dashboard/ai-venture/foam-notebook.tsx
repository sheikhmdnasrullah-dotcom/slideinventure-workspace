"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkWikiLink from "remark-wiki-link"
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Plus, Trash2, RefreshCw, Network, Eye, Pencil, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type Note = {
  id: string
  title: string | null
  content: string
  scope: string
  tags: string[]
  links: string[]
  updated_at: string
}

const WIKILINK = /\[\[([^\]\n]+)\]\]/g

function extractWikiLinks(md: string): string[] {
  const out = new Set<string>()
  let m: RegExpExecArray | null
  const re = new RegExp(WIKILINK)
  while ((m = re.exec(md))) {
    const raw = m[1].split("|")[0].trim()
    if (raw) out.add(raw)
  }
  return [...out]
}

function normalizeTitle(t: string): string {
  return t.trim().toLowerCase()
}

export function FoamNotebook() {
  const [notes, setNotes] = React.useState<Note[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [title, setTitle] = React.useState("")
  const [content, setContent] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle")
  const [tab, setTab] = React.useState<"write" | "preview" | "graph">("write")
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const selected = notes.find((n) => n.id === selectedId) || null
  const titleToId = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const n of notes) map.set(normalizeTitle(n.title || ""), n.id)
    return map
  }, [notes])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/notes?scope=ai-venture")
      const data = await res.json()
      const list: Note[] = data.notes || []
      setNotes(list)
      if (!selectedId && list.length) {
        const first = list[0]
        setSelectedId(first.id)
        setTitle(first.title || "")
        setContent(typeof first.content === "string" ? first.content : "")
      }
    } catch {
      toast.error("Failed to load notes")
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  React.useEffect(() => {
    void load()
  }, [load])

  const persist = React.useCallback(
    async (nextTitle: string, nextContent: string) => {
      if (!selectedId) return
      setStatus("saving")
      const links = extractWikiLinks(nextContent)
      try {
        const res = await fetch(`/api/notes/${selectedId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: nextTitle, content: nextContent, links }),
        })
        if (!res.ok) throw new Error("save failed")
        const { note } = await res.json()
        setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, ...note } : n)))
        setStatus("saved")
      } catch {
        toast.error("Failed to save note")
        setStatus("idle")
      }
    },
    [selectedId]
  )

  const onContentChange = (v: string) => {
    setContent(v)
    setStatus("saving")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persist(title, v), 700)
  }

  const onTitleChange = (v: string) => {
    setTitle(v)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persist(v, content), 700)
  }

  const createNote = async () => {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled", content: "", scope: "ai-venture", links: [] }),
      })
      const { note } = await res.json()
      setNotes((prev) => [note, ...prev])
      setSelectedId(note.id)
      setTitle(note.title || "")
      setContent("")
      setTab("write")
    } catch {
      toast.error("Failed to create note")
    }
  }

  const deleteNote = async (id: string) => {
    try {
      await fetch(`/api/notes/${id}`, { method: "DELETE" })
      setNotes((prev) => prev.filter((n) => n.id !== id))
      if (selectedId === id) {
        setSelectedId(null)
        setTitle("")
        setContent("")
      }
      toast.success("Note deleted")
    } catch {
      toast.error("Failed to delete note")
    }
  }

  const selectByTitle = (t: string) => {
    const id = titleToId.get(normalizeTitle(t))
    if (id) {
      const n = notes.find((x) => x.id === id)!
      setSelectedId(id)
      setTitle(n.title || "")
      setContent(typeof n.content === "string" ? n.content : "")
      setTab("write")
    } else {
      toast("No note titled \"" + t + "\" yet")
    }
  }

  const backlinks = React.useMemo(() => {
    if (!selected) return []
    const cur = normalizeTitle(selected.title || "")
    return notes.filter((n) => n.id !== selected.id && (n.links || []).some((l) => normalizeTitle(l) === cur))
  }, [notes, selected])

  const graphNodes = notes.map((n) => ({
    id: n.id,
    data: { label: n.title || "Untitled" },
    position: { x: (notes.indexOf(n) % 5) * 160, y: Math.floor(notes.indexOf(n) / 5) * 120 },
  }))
  const graphEdges = notes.flatMap((n) =>
    (n.links || [])
      .map((l) => titleToId.get(normalizeTitle(l)))
      .filter((target): target is string => Boolean(target) && target !== n.id)
      .map((target) => ({ id: `${n.id}->${target}`, source: n.id, target, label: "links" }))
  )

  return (
    <div className="flex h-full min-h-0">
      {/* note list */}
      <div className="w-56 shrink-0 border-r border-border/60 flex flex-col">
        <div className="flex items-center gap-2 p-2 border-b border-border/60">
          <Button size="sm" variant="outline" onClick={createNote} className="flex-1">
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void load()} title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {notes.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setSelectedId(n.id)
                  setTitle(n.title || "")
                  setContent(typeof n.content === "string" ? n.content : "")
                  setTab("write")
                }}
                className={cn(
                  "w-full text-left text-sm rounded px-2 py-1.5 flex items-center justify-between gap-2",
                  n.id === selectedId ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                )}
              >
                <span className="truncate">{n.title || "Untitled"}</span>
                <Trash2
                  className="h-3.5 w-3.5 opacity-50 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    void deleteNote(n.id)
                  }}
                />
              </button>
            ))}
            {!loading && notes.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-4">No notes yet. Hit New.</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* editor / preview / graph */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 p-2 border-b border-border/60">
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Note title"
            className="flex-1 bg-transparent text-sm font-medium outline-none"
          />
          <div className="flex items-center gap-1">
            {(["write", "preview", "graph"] as const).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={tab === t ? "secondary" : "ghost"}
                onClick={() => setTab(t)}
              >
                {t === "write" && <Pencil className="h-3.5 w-3.5" />}
                {t === "preview" && <Eye className="h-3.5 w-3.5" />}
                {t === "graph" && <Network className="h-3.5 w-3.5" />}
                <span className="capitalize ml-1">{t}</span>
              </Button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground w-12 text-right">
            {status === "saving" && <Loader2 className="h-3.5 w-3.5 inline animate-spin" />}
            {status === "saved" && "saved"}
          </span>
        </div>

        <div className="flex-1 min-h-0">
          {!selected && (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">
              Select or create a note
            </div>
          )}

          {selected && tab === "write" && (
            <textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder={"Write markdown. Link notes with [[Note Title]]."}
              className="h-full w-full resize-none p-4 font-mono text-sm outline-none bg-transparent"
              spellCheck={false}
            />
          )}

          {selected && tab === "preview" && (
            <ScrollArea className="h-full">
              <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[[remarkWikiLink, { aliasDivider: "|", hrefTemplate: (p: string | string[]) => `#/wiki/${Array.isArray(p) ? p[0] : p}` }]]}
                  components={{
                    a: ({ href, children }) => {
                      if (href && href.startsWith("#/wiki/")) {
                        const t = href.replace("#/wiki/", "")
                        return (
                          <a
                            className="text-primary underline cursor-pointer"
                            onClick={(e) => {
                              e.preventDefault()
                              selectByTitle(t)
                            }}
                          >
                            {children}
                          </a>
                        )
                      }
                      return (
                        <a href={href} target="_blank" rel="noreferrer">
                          {children}
                        </a>
                      )
                    },
                  }}
                >
                  {content || "_Empty note_"}
                </ReactMarkdown>

                <h3 className="mt-8 text-xs uppercase tracking-wide text-muted-foreground">Backlinks</h3>
                {backlinks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No backlinks yet.</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {backlinks.map((b) => (
                      <li key={b.id}>
                        <button
                          className="text-primary underline"
                          onClick={() => {
                            setSelectedId(b.id)
                            setTitle(b.title || "")
                            setContent(typeof b.content === "string" ? b.content : "")
                          }}
                        >
                          {b.title || "Untitled"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </ScrollArea>
          )}

          {selected && tab === "graph" && (
            <ReactFlow nodes={graphNodes} edges={graphEdges} fitView>
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          )}
        </div>
      </div>
    </div>
  )
}

export default FoamNotebook
