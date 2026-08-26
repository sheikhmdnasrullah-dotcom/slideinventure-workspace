"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { formatDistanceToNow } from "date-fns"
import { FileText, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

// The same BlockNote editor Notepad uses (with image upload) — no separate note architecture.
const Notepad = dynamic(() => import("@/components/dashboard/v3/note/dynamic"), {
  ssr: false,
  loading: () => <div className="p-6 text-sm text-muted-foreground">Loading editor…</div>,
})

export type Idea = { id: string; title: string | null; content: string; updated_at: string }

export function IdeasPanel({
  ideas,
  loading,
  onChanged,
}: {
  ideas: Idea[]
  loading: boolean
  onChanged: () => void
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [content, setContent] = React.useState("[]")
  const [title, setTitle] = React.useState("")
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle")
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const createIdea = async () => {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "ai-venture" }),
      })
      const data = await res.json()
      onChanged()
      selectIdea(data.note)
    } catch {
      toast.error("Failed to create idea")
    }
  }

  const selectIdea = async (idea: { id: string; title: string | null }) => {
    setTitle(idea.title ?? "")
    try {
      const res = await fetch(`/api/notes/${idea.id}`)
      const data = await res.json()
      setContent(data.note?.content ?? "[]")
    } catch {
      setContent("[]")
    } finally {
      setSelectedId(idea.id)
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
          onChanged()
        } catch {
          toast.error("Failed to save idea")
          setStatus("idle")
        }
      }, 700)
    },
    [onChanged]
  )

  const handleChange = (next: string) => {
    setContent(next)
    if (selectedId) persist(selectedId, next, title)
  }

  const deleteIdea = async (id: string) => {
    try {
      await fetch(`/api/notes/${id}`, { method: "DELETE" })
      if (selectedId === id) {
        setSelectedId(null)
        setContent("[]")
      }
      toast.success("Idea deleted")
      onChanged()
    } catch {
      toast.error("Failed to delete idea")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Brainstormed Ideas</h2>
        <Button size="sm" className="gap-1.5" onClick={createIdea}>
          <Plus className="size-4" /> New idea
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted/20" />
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <Card>
          <CardContent className="flex h-32 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <p className="text-sm">No ideas yet.</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={createIdea}>
              <Plus className="size-4" /> New idea
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex h-[560px] overflow-hidden rounded-lg border">
          <aside className="w-64 shrink-0 border-r">
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-1 p-2">
                {ideas.map((idea) => (
                  <button
                    key={idea.id}
                    onClick={() => selectIdea(idea)}
                    className={cn(
                      "group flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors hover:bg-accent/30",
                      selectedId === idea.id && "bg-muted"
                    )}
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{idea.title || "Untitled idea"}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(idea.updated_at), { addSuffix: true })}
                      </span>
                    </span>
                    <Trash2
                      className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteIdea(idea.id)
                      }}
                    />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </aside>
          <section className="flex flex-1 flex-col overflow-auto">
            {selectedId ? (
              <>
                <div className="flex items-center gap-2 px-4 pt-4 pb-1">
                  <input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value)
                      if (selectedId) persist(selectedId, content, e.target.value)
                    }}
                    placeholder="Untitled"
                    className="flex-1 bg-transparent text-xl font-bold outline-none placeholder:text-muted-foreground/40"
                  />
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    {status === "saving" && <Loader2 className="size-3 animate-spin" />}
                    {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
                  </span>
                </div>
                <Notepad key={selectedId} initialContent={content} onChange={handleChange} />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Select an idea, or click &quot;New idea&quot; to start writing.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
