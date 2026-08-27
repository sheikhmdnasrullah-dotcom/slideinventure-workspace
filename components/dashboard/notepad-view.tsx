"use client"

/* eslint-disable react-hooks/set-state-in-effect */
// loadNotes() fetches from the API and updates state after async I/O; there is
// no synchronous cascading render because all state updates happen after await.

import * as React from "react"
import dynamic from "next/dynamic"
import { Plus, Trash2, FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const Notepad = dynamic(() => import("@/components/dashboard/v3/note/dynamic"), {
  ssr: false,
  loading: () => <div className="p-6 text-muted-foreground">Loading editor…</div>,
})

type Note = { id: string; title: string | null; content: string; updated_at: string }

// Same note engine the main dashboard Notepad uses (/api/notes, which already
// supports scope=global|ai-venture) — parameterized by scope instead of
// duplicated, so AI Venture notes are real notes in the same system, not a
// second disconnected note store.
export function NotepadView({ scope = "global" }: { scope?: "global" | "ai-venture" }) {
  const [notes, setNotes] = React.useState<Note[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [content, setContent] = React.useState<string>("[]")
  const [title, setTitle] = React.useState<string>("")
  const [loading, setLoading] = React.useState(true)
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle")
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Always pass scope explicitly (never omit it) — /api/notes returns every
  // scope mixed together when the param is absent, which would leak AI
  // Venture notes into the main dashboard Notepad and vice versa.
  const scopeQuery = `?scope=${scope}`

  const loadNotes = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/notes${scopeQuery}`)
      const data = await res.json()
      setNotes(data.notes ?? [])
    } catch {
      toast.error("Failed to load notes")
    } finally {
      setLoading(false)
    }
  }, [scopeQuery])

  React.useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const handleWrite = async () => {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled note", scope }),
      })
      const data = await res.json()
      const note = data.note as Note
      setNotes((prev) => [note, ...prev])
      selectNote(note)
    } catch {
      toast.error("Failed to create note")
    }
  }

  const selectNote = async (note: Note) => {
    setTitle(note.title ?? "")
    try {
      const res = await fetch(`/api/notes/${note.id}`)
      const data = await res.json()
      setContent(data.note?.content ?? "[]")
    } catch {
      setContent("[]")
    } finally {
      // Set the selected id only after content is resolved so the editor
      // mounts with the correct document.
      setSelectedId(note.id)
      setStatus("idle")
    }
  }

  const persist = React.useCallback(
    (id: string, nextContent: string, nextTitle: string) => {
      setStatus("saving")
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        try {
          await fetch(`/api/notes/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: nextContent, title: nextTitle }),
          })
          setStatus("saved")
          setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title: nextTitle, updated_at: new Date().toISOString() } : n)))
        } catch {
          toast.error("Failed to save note")
          setStatus("idle")
        }
      }, 700)
    },
    []
  )

  const handleChange = (next: string) => {
    setContent(next)
    if (selectedId) persist(selectedId, next, title)
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/notes/${id}`, { method: "DELETE" })
      setNotes((prev) => prev.filter((n) => n.id !== id))
      if (selectedId === id) {
        setSelectedId(null)
        setContent("[]")
      }
      toast.success("Note deleted")
    } catch {
      toast.error("Failed to delete note")
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold">Notepad</h1>
          <p className="text-sm text-muted-foreground">Rich-text notes, autosaved to your workspace.</p>
        </div>
        <Button onClick={handleWrite} className="gap-2">
          <Plus className="size-4" /> Write Note
        </Button>
      </div>
      <Separator />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 shrink-0 border-r">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-1 p-3">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading…</div>
              ) : notes.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No notes yet. Click "Write Note".</div>
              ) : (
                notes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => selectNote(n)}
                    className={cn(
                      "group flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent/20",
                      selectedId === n.id && "bg-muted"
                    )}
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate font-medium">{n.title || "Untitled"}</span>
                    <Trash2
                      className="size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(n.id)
                      }}
                    />
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </aside>

        <section className="flex flex-1 flex-col">
          {selectedId ? (
            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-auto">
              <div className="flex items-center gap-2 px-6 pt-8 pb-2">
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    persist(selectedId, content, e.target.value)
                  }}
                  placeholder="Untitled"
                  className="flex-1 bg-transparent text-3xl font-bold outline-none placeholder:text-muted-foreground/40"
                />
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {status === "saving" && <Loader2 className="size-3 animate-spin" />}
                  {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
                </span>
              </div>
              <div className="px-6 pb-10">
                <Notepad key={selectedId} initialContent={content} onChange={handleChange} />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select a note or click "Write Note" to start.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
