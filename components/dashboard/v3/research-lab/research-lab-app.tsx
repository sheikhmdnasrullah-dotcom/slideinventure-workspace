"use client"

/* eslint-disable react-hooks/set-state-in-effect */
// Loading a workspace and resetting the editor buffer on selection change is
// a deliberate derived-state sync, not a render loop.

import * as React from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
import type { Editor } from "tldraw"
import { toast } from "sonner"
import {
  ArrowLeft,
  Beaker,
  FileUp,
  Loader2,
  MoreVertical,
  Sparkles,
  StickyNote,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Reveal, Stagger, StaggerItem } from "@/components/system/motion"
import { SectionErrorBoundary } from "@/components/system/error-boundary"

const Whiteboard = dynamic(() => import("@/components/dashboard/v3/whiteboard/Whiteboard"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" /> Preparing canvas…
    </div>
  ),
}) as unknown as React.ComponentType<{
  boardId?: string
  initialData?: string
  onChange: (data: string) => void
  onMount: (editor: Editor) => void
}>

type ResearchWorkspace = {
  id: string
  title: string
  scope: "global" | "ai-venture"
  documentIds: string[]
  createdAt: string
  updatedAt: string
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const sec = Math.max(1, Math.floor((Date.now() - then) / 1000))
  if (sec < 60) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

function ResearchLabAppInner({ scope, syncUrl }: { scope: "global" | "ai-venture"; syncUrl?: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [workspaces, setWorkspaces] = React.useState<ResearchWorkspace[] | null>(null)
  const [activeId, setActiveIdState] = React.useState<string | null>(syncUrl ? searchParams.get("w") : null)
  const setActiveId = React.useCallback(
    (id: string | null) => {
      setActiveIdState(id)
      if (syncUrl) {
        const url = id ? `/research-lab?w=${id}` : "/research-lab"
        router.replace(url, { scroll: false })
      }
    },
    [syncUrl, router]
  )
  const [active, setActive] = React.useState<ResearchWorkspace | null>(null)
  const [content, setContent] = React.useState<string>("{}")
  const [title, setTitle] = React.useState("")
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle")
  const [creating, setCreating] = React.useState(false)
  const [asking, setAsking] = React.useState(false)
  const [question, setQuestion] = React.useState("")
  const editorRef = React.useRef<Editor | null>(null)
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const loadList = React.useCallback(async () => {
    try {
      const params = scope === "ai-venture" ? "?scope=ai-venture" : ""
      const res = await fetch(`/api/research${params}`)
      if (!res.ok) throw new Error("Failed to load research")
      const data = await res.json()
      setWorkspaces(data.workspaces ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load research")
      setWorkspaces([])
    }
  }, [scope])

  React.useEffect(() => {
    loadList()
  }, [loadList])

  const openWorkspace = React.useCallback(async (id: string) => {
    setActiveId(id)
    try {
      const res = await fetch(`/api/research/${id}`)
      if (!res.ok) throw new Error("Failed to open research")
      const data = await res.json()
      setActive(data)
      setTitle(data.title)
      setContent(data.content || "{}")
      setStatus("idle")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to open research")
      setActiveId(null)
    }
  }, [setActiveId])

  // Deep-link support: a refresh while inside a workspace (?w=<id>) reopens
  // it directly instead of dropping back to the list.
  React.useEffect(() => {
    if (syncUrl && activeId && !active) {
      openWorkspace(activeId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleNew = async () => {
    setCreating(true)
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      })
      if (!res.ok) throw new Error("Failed to create research workspace")
      const data = await res.json()
      setWorkspaces((prev) => [data.workspace, ...(prev ?? [])])
      openWorkspace(data.workspace.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create research workspace")
    } finally {
      setCreating(false)
    }
  }

  const persist = React.useCallback(
    (patch: { title?: string; content?: string; documentIds?: string[] }) => {
      if (!activeId) return
      setStatus("saving")
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        try {
          await fetch(`/api/research/${activeId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          })
          setStatus("saved")
          setWorkspaces((prev) =>
            prev?.map((w) => (w.id === activeId ? { ...w, ...patch, updatedAt: new Date().toISOString() } : w)) ?? null
          )
        } catch {
          toast.error("Couldn't save — retrying shortly")
          setStatus("idle")
        }
      }, 600)
    },
    [activeId]
  )

  const handleTitleChange = (value: string) => {
    setTitle(value)
    persist({ title: value })
  }

  const handleCanvasChange = (data: string) => {
    setContent(data)
    persist({ content: data })
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this research workspace? This can't be undone.")) return
    try {
      await fetch(`/api/research/${id}`, { method: "DELETE" })
      setWorkspaces((prev) => prev?.filter((w) => w.id !== id) ?? null)
      if (activeId === id) {
        setActiveId(null)
        setActive(null)
      }
      toast.success("Deleted")
    } catch {
      toast.error("Failed to delete")
    }
  }

  const handleStickyNote = async () => {
    const editor = editorRef.current
    if (!editor) return
    const { createShapeId } = await import("@tldraw/tlschema")
    const center = editor.getViewportPageBounds().center
    const id = createShapeId()
    editor.createShape({
      id,
      type: "note",
      x: center.x - 100,
      y: center.y - 100,
    })
    editor.select(id)
    editor.setEditingShape(id)
  }

  const handleUploadClick = () => fileInputRef.current?.click()

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !editorRef.current || !active) return
    const editor = editorRef.current
    const toastId = toast.loading(`Uploading ${file.name}…`)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("title", file.name)
      const res = await fetch("/api/documents/upload", { method: "POST", body: formData })
      if (!res.ok) throw new Error("Upload failed")
      const doc = await res.json()

      const nextDocIds = [...(active.documentIds || []), doc.id]
      setActive((prev) => (prev ? { ...prev, documentIds: nextDocIds } : prev))
      persist({ documentIds: nextDocIds })

      const center = editor.getViewportPageBounds().center
      await editor.putExternalContent({
        type: "url",
        url: doc.url,
        point: { x: center.x, y: center.y },
      })
      toast.success("Added to canvas", { id: toastId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed", { id: toastId })
    }
  }

  const handleAsk = async () => {
    const q = question.trim()
    if (!q || !editorRef.current) return
    setAsking(true)
    try {
      const editor = editorRef.current
      const shapes = editor.getCurrentPageShapes()
      const context = shapes
        .map((s) => (editor.getShapeUtil(s).getText?.(s) ?? "").trim())
        .filter(Boolean)
        .slice(0, 20)
        .join("\n")

      const res = await fetch("/api/research/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context }),
      })
      if (!res.ok) throw new Error("AI request failed")
      const data = await res.json()

      const { toRichText, createShapeId } = await import("@tldraw/tlschema")
      const center = editor.getViewportPageBounds().center
      const id = createShapeId()
      editor.createShape({
        id,
        type: "text",
        x: center.x - 150,
        y: center.y - 60,
        props: { richText: toRichText(data.answer), w: 320, autoSize: false },
      })
      setQuestion("")
      toast.success("Added AI answer to canvas")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed")
    } finally {
      setAsking(false)
    }
  }

  // ── Canvas view ──────────────────────────────────────────────────────
  if (activeId) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--rule)" }}>
          <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => { setActiveId(null); setActive(null) }}>
            <ArrowLeft className="size-4" />
          </Button>
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="h-8 max-w-xs border-none bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-0"
            placeholder="Untitled Research"
          />
          <span className="text-xs text-muted-foreground">
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleStickyNote} title="Add a sticky note">
              <StickyNote className="size-4" /> Sticky Note
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleUploadClick} title="Upload a PDF or document">
              <FileUp className="size-4" /> Upload
            </Button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUploadFile} />
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="ghost" size="sm" className="gap-1.5" title="Ask AI">
                    <Sparkles className="size-4" /> Ask AI
                  </Button>
                }
              />
              <PopoverContent align="end" className="w-80">
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Compare these two frameworks…"
                    className="min-h-[70px] text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAsk()
                    }}
                  />
                  <Button size="sm" onClick={handleAsk} disabled={asking || !question.trim()} className="self-end gap-1.5">
                    {asking ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                    {asking ? "Thinking…" : "Ask"}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="relative flex-1">
          <Whiteboard
            boardId={activeId}
            initialData={content}
            onChange={handleCanvasChange}
            onMount={(editor) => {
              editorRef.current = editor
            }}
          />
        </div>
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <Reveal className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Beaker className="size-5 text-[var(--text-accent)]" />
          <h1 className="text-lg font-semibold">Research Lab</h1>
        </div>
        <Button onClick={handleNew} disabled={creating} className="gap-1.5">
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          New Research
        </Button>
      </Reveal>

      {workspaces === null ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
        </div>
      ) : workspaces.length === 0 ? (
        <Reveal className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Beaker className="size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Start exploring.</p>
          <Button onClick={handleNew} variant="outline" className="gap-1.5">
            <Sparkles className="size-4" /> New Research
          </Button>
        </Reveal>
      ) : (
        <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((w) => (
            <StaggerItem key={w.id}>
              <div
                className="motion-card group relative flex cursor-pointer flex-col gap-2 rounded-lg border p-4"
                style={{ borderColor: "var(--rule)" }}
                onClick={() => openWorkspace(w.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-1 text-sm font-medium">{w.title}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <button
                          className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-accent"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="size-4" />
                        </button>
                      }
                    />
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => handleDelete(w.id)} className="text-destructive gap-2">
                        <Trash2 className="size-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <span className="text-xs text-muted-foreground">{timeAgo(w.updatedAt)}</span>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  )
}

export function ResearchLabApp({ scope, syncUrl }: { scope: "global" | "ai-venture"; syncUrl?: boolean }) {
  return (
    <SectionErrorBoundary label="Research Lab">
      <ResearchLabAppInner scope={scope} syncUrl={syncUrl} />
    </SectionErrorBoundary>
  )
}
