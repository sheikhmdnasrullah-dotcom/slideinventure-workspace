"use client"

/* eslint-disable react-hooks/set-state-in-effect */
// loadNotes() fetches from the API and updates state after async I/O; there is
// no synchronous cascading render because all state updates happen after await.

import * as React from "react"
import dynamic from "next/dynamic"
import { useQueryState } from "nuqs"
import { formatDistanceToNow } from "date-fns"
import {
  Plus,
  Trash2,
  FileText,
  Loader2,
  Pencil,
  X,
  Download,
  FileCode2,
  File,
  Sparkles,
  Eye,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useLiveRefresh } from "@/components/providers/event-stream"
import { DeployAgentPalette } from "@/components/dashboard/agents/deploy-agent-palette"
import {
  useDeployedAgent,
  updateNoteContext,
  toggleDeployViewMode,
} from "@/lib/agents/deployed-agent-store"
import { ResearchPanel } from "@/components/dashboard/research/research-panel"
import {
  noteToMarkdown,
  noteToPlainText,
  noteToPdfBlob,
  downloadFile,
  sanitizeFilename,
  saveToAiVentureFiles,
} from "@/lib/notes/export-note"
import { NotepadPdfPreview } from "@/components/dashboard/notepad-pdf-preview"

const Notepad = dynamic(() => import("@/components/dashboard/v3/note/dynamic"), {
  ssr: false,
  loading: () => <div className="p-6 text-muted-foreground">Loading editor</div>,
})

type Note = { id: string; title: string | null; content: string; updated_at: string }

// Same note engine the main dashboard Notepad uses (/api/notes, which already
// supports scope=global|ai-venture), parameterized by scope instead of
// duplicated, so AI Venture notes are real notes in the same system, not a
// second disconnected note store.

/**
 * When `centered`, the note editor mounts as a large, centered pop-up overlay
 * (an independent "playground") instead of being squeezed beside the note
 * list. Otherwise it renders inline. The child is identical in both cases.
 */
function CenteredEditor({
  centered,
  onClose,
  children,
}: {
  centered: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  if (!centered) return <>{children}</>
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="!flex h-[88vh] w-[92vw] max-w-[1000px] flex-col !gap-0 overflow-hidden !rounded-lg !border !border-rule !bg-[var(--surface)] !p-0 shadow-2xl"
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}
export function NotepadView({
  scope = "global",
  centered = false,
}: {
  scope?: "global" | "ai-venture" | "brainstorm"
  centered?: boolean
}) {
  const [deepLinkNote, setDeepLinkNote] = useQueryState("note")
  const [notes, setNotes] = React.useState<Note[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [content, setContent] = React.useState<string>("[]")
  const [title, setTitle] = React.useState<string>("")
  const [loading, setLoading] = React.useState(true)
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle")
  const [exporting, setExporting] = React.useState(false)
  const [renamingId, setRenamingId] = React.useState<string | null>(null)
  const [draftTitle, setDraftTitle] = React.useState("")
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const [researchOpen, setResearchOpen] = React.useState(false)
  const [deployOpen, setDeployOpen] = React.useState(false)
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const deployed = useDeployedAgent()
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Sync active note context with deployed agent store
  React.useEffect(() => {
    if (selectedId) {
      updateNoteContext({ id: selectedId, title: title || "Untitled", content })
    } else {
      updateNoteContext(null)
    }
  }, [selectedId, title, content])

  // Always pass scope explicitly (never omit it): /api/notes returns every
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

  useLiveRefresh(loadNotes, { types: ["note."] })

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

  // Deep link from Research Lab ("Open source"): once notes have loaded, open
  // the referenced note directly, then drop the query param.
  React.useEffect(() => {
    if (loading || !deepLinkNote) return
    const note = notes.find((n) => n.id === deepLinkNote)
    if (note) selectNote(note)
    void setDeepLinkNote(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, deepLinkNote, notes])

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

  // Listen for agent inserting text into note
  React.useEffect(() => {
    const handleInsert = (e: Event) => {
      const custom = e as CustomEvent<{ text: string }>
      const textToInsert = custom.detail?.text
      if (!textToInsert || !selectedId) return

      try {
        let existingBlocks: any[] = []
        try {
          const parsed = JSON.parse(content || "[]")
          if (Array.isArray(parsed)) existingBlocks = parsed
        } catch {
          existingBlocks = []
        }

        const lines = textToInsert.split("\n").filter(Boolean)
        const newBlocks = lines.map((line) => ({
          id: crypto.randomUUID(),
          type: "paragraph",
          props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
          content: [{ type: "text", text: line, styles: {} }],
          children: [],
        }))

        const nextBlocks = [...existingBlocks, ...newBlocks]
        const nextContent = JSON.stringify(nextBlocks)
        setContent(nextContent)
        persist(selectedId, nextContent, title)
      } catch (err) {
        console.error("Failed to insert text to note:", err)
      }
    }

    window.addEventListener("notepad:insert-text", handleInsert)
    return () => window.removeEventListener("notepad:insert-text", handleInsert)
  }, [content, selectedId, title, persist])

  const handleChange = (next: string) => {
    setContent(next)
    if (selectedId) persist(selectedId, next, title)
  }

  const renameNote = async (id: string, value: string) => {
    const next = value.trim() || "Untitled note"
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title: next } : n)))
    if (selectedId === id) setTitle(next)
    setRenamingId(null)
    try {
      await fetch(`/api/notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      })
    } catch {
      toast.error("Failed to rename note")
      void loadNotes()
    }
  }

  const requestDelete = (id: string) => setDeleteId(id)

  const confirmDelete = async () => {
    if (!deleteId) return
    const id = deleteId
    setDeleteId(null)
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

  /**
   * Exports the active note to local file download and simultaneously saves
   * to AI Venture Files under the "Notepad" directory.
   */
  const handleExport = async (format: "txt" | "md" | "pdf" | "all") => {
    if (!selectedId) return
    const base = sanitizeFilename(title || "Untitled Note")
    setExporting(true)
    const toastId = toast.loading(`Exporting as ${format.toUpperCase()}...`)

    try {
      const savedNames: string[] = []

      if (format === "txt" || format === "all") {
        const txt = noteToPlainText(title, content)
        downloadFile(txt, `${base}.txt`, "text/plain;charset=utf-8")
        const ok = await saveToAiVentureFiles("Notepad", `${base}.txt`, txt)
        if (ok) savedNames.push(`${base}.txt`)
      }

      if (format === "md" || format === "all") {
        const md = noteToMarkdown(title, content)
        downloadFile(md, `${base}.md`, "text/markdown;charset=utf-8")
        const ok = await saveToAiVentureFiles("Notepad", `${base}.md`, md)
        if (ok) savedNames.push(`${base}.md`)
      }

      if (format === "pdf" || format === "all") {
        const pdfBlob = await noteToPdfBlob(title, content)
        downloadFile(pdfBlob, `${base}.pdf`, "application/pdf")
        const ok = await saveToAiVentureFiles("Notepad", `${base}.pdf`, pdfBlob)
        if (ok) savedNames.push(`${base}.pdf`)
      }

      toast.success(
        format === "all"
          ? `Downloaded & saved .txt, .md, and .pdf to AI Venture Files (Notepad/)`
          : `Downloaded & saved ${base}.${format} to AI Venture Files (Notepad/)`,
        { id: toastId }
      )
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Export failed", { id: toastId })
    } finally {
      setExporting(false)
    }
  }

  // Notes that should never be included in a bulk export (e.g. test scratch
  // notes the user keeps around in the Notepad but doesn't want in research
  // material). Match is case-insensitive on the trimmed title.
  const SKIP_TITLES = new Set(["Notes on SlideIn Venture Concept"].map((t) => t.toLowerCase()))

  /**
   * Bulk-exports every note in the current scope as Markdown: downloads each
   * file locally AND saves it to AI Venture Files under the "Notepad" folder,
   * then writes a `_notes-index.md` manifest so every exported note can be
   * located again. The test note is excluded.
   */
  const handleExportAll = async () => {
    if (notes.length === 0) {
      toast.error("No notes to export")
      return
    }
    setExporting(true)
    const toastId = toast.loading("Exporting all notes (.txt, .md, .pdf)...")
    try {
      const manifest: string[] = [
        "# AI Venture Notepad — Exported Notes",
        "",
        `_Generated ${new Date().toISOString()} • ${notes.length} note(s) in scope_`,
        "",
        "## Files (saved to AI Venture Files → Notepad/ and downloaded locally)",
        "",
      ]

      let exported = 0
      let skipped = 0

      for (const note of notes) {
        const title = (note.title || "Untitled Note").trim()
        if (SKIP_TITLES.has(title.toLowerCase())) {
          skipped++
          continue
        }
        const base = sanitizeFilename(title)
        const md = noteToMarkdown(title, note.content)
        const txt = noteToPlainText(title, note.content)

        // Local browser downloads
        downloadFile(txt, `${base}.txt`, "text/plain;charset=utf-8")
        downloadFile(md, `${base}.md`, "text/markdown;charset=utf-8")
        const pdfBlob = await noteToPdfBlob(title, note.content)
        downloadFile(pdfBlob, `${base}.pdf`, "application/pdf")

        // Saved into AI Venture Files → Notepad/ (also visible in the Files subsection)
        const savedMd = await saveToAiVentureFiles("Notepad", `${base}.md`, md)
        const savedTxt = await saveToAiVentureFiles("Notepad", `${base}.txt`, txt)
        const savedPdf = await saveToAiVentureFiles("Notepad", `${base}.pdf`, pdfBlob)

        if (savedMd || savedTxt || savedPdf) {
          const files = [
            savedTxt && `\`Notepad/${base}.txt\``,
            savedMd && `\`Notepad/${base}.md\``,
            savedPdf && `\`Notepad/${base}.pdf\``,
          ]
            .filter(Boolean)
            .join(", ")
          manifest.push(`- **${title}** → ${files}`)
          exported++
        }
      }

      const manifestContent = manifest.join("\n").trim() + "\n"
      // Local + Files manifest so all notes can be located for business planning
      downloadFile(manifestContent, "_notes-index.md", "text/markdown;charset=utf-8")
      await saveToAiVentureFiles("Notepad", "_notes-index.md", manifestContent)

      toast.success(
        `Exported ${exported} note(s) as .txt/.md/.pdf to Notepad/ (skipped ${skipped} test note). Index: Notepad/_notes-index.md.`,
        { id: toastId, duration: 6000 }
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk export failed", { id: toastId })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="font-display text-2xl text-ink-strong">Notepad</h1>
          <p className="font-body text-sm text-ink-muted">Rich-text notes, autosaved to your workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            disabled={exporting || notes.length === 0}
            className="gap-1.5 cursor-pointer text-xs font-medium h-8 shadow-xs hover:border-primary/50"
            title="Download every note as .txt, .md and .pdf to Notepad/ (skips the test note)"
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5 text-primary" />
            )}
            <span>Download all</span>
          </Button>
          <Button onClick={handleWrite} className="gap-2 shadow-xs font-medium">
            <Plus className="size-4" /> New note
          </Button>
        </div>
      </div>
      <Separator />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 shrink-0 border-r bg-card/30">
          <ScrollArea className="h-full" data-lenis-prevent>
            <div className="flex flex-col gap-1 p-3">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Loading notes...
                </div>
              ) : notes.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No notes yet. Click "New note".</div>
              ) : (
                notes.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "group flex items-center gap-2 rounded-lg border border-transparent py-2 px-3 text-left text-sm transition-colors hover:bg-muted/60 cursor-pointer",
                      selectedId === n.id && "bg-muted font-medium border-rule shadow-2xs"
                    )}
                  >
                    <FileText className={cn("size-4 shrink-0", selectedId === n.id ? "text-primary" : "text-ink-faint")} />
                    {renamingId === n.id ? (
                      <input
                        autoFocus
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onBlur={() => renameNote(n.id, draftTitle)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            renameNote(n.id, draftTitle)
                          } else if (e.key === "Escape") {
                            e.preventDefault()
                            setRenamingId(null)
                          }
                        }}
                        className="flex-1 truncate bg-transparent font-medium outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => selectNote(n)}
                        className="flex-1 truncate text-left font-medium hover:underline cursor-pointer"
                      >
                        {n.title || "Untitled"}
                      </button>
                    )}
                    <span className="shrink-0 text-[11px] text-muted-foreground/80">
                      {n.updated_at
                        ? formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })
                        : ""}
                    </span>
                    {renamingId !== n.id && (
                      <button
                        type="button"
                        aria-label="Rename"
                        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenamingId(n.id)
                          setDraftTitle(n.title || "Untitled")
                        }}
                        title="Rename note"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Delete"
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        requestDelete(n.id)
                      }}
                      title="Delete note"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </aside>

        <section className="flex flex-1 flex-col">
          {selectedId ? (
            <CenteredEditor centered={centered} onClose={() => setSelectedId(null)}>
              <div
                className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-auto transition-colors"
                data-lenis-prevent
                data-droppable="notepad"
                data-note-id={selectedId}
                data-note-title={title || "Untitled"}
              >
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-8 pb-3 border-b border-rule/50">
                <div className="flex-1 min-w-[200px] flex items-center gap-2">
                  <input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value)
                      persist(selectedId, content, e.target.value)
                    }}
                    placeholder="Untitled"
                    className="w-full bg-transparent text-2xl lg:text-3xl font-bold outline-none placeholder:text-muted-foreground/40 text-foreground"
                  />
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    {status === "saving" && <Loader2 className="size-3 animate-spin" />}
                    {status === "saving" ? "Saving" : status === "saved" ? "Saved" : ""}
                  </span>
                </div>

                {/* Top Action Toolbar: Export & Download + Deploy Agent */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Export & Save Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!selectedId || exporting}
                        className="gap-1.5 cursor-pointer text-xs font-medium h-8 shadow-xs hover:border-primary/50"
                      >
                        {exporting ? (
                          <Loader2 className="size-3.5 animate-spin text-primary" />
                        ) : (
                          <Download className="size-3.5 text-primary" />
                        )}
                        <span>Export &amp; Download</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-68">
                      <div className="px-2.5 py-1.5 text-[11px] text-muted-foreground font-normal">
                        Downloads file locally and saves to <span className="font-semibold text-foreground">AI Venture / Files</span> simultaneously:
                      </div>
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem
                        onClick={() => handleExport("txt")}
                        className="cursor-pointer gap-2.5 py-2 text-xs"
                      >
                        <div className="flex size-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-500 shrink-0">
                          <FileText className="size-4" />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-medium text-foreground">Plain Text (.txt)</span>
                          <span className="text-[10px] text-muted-foreground">Clean formatted text file</span>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => handleExport("md")}
                        className="cursor-pointer gap-2.5 py-2 text-xs"
                      >
                        <div className="flex size-7 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-500 shrink-0">
                          <FileCode2 className="size-4" />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-medium text-foreground">Markdown (.md)</span>
                          <span className="text-[10px] text-muted-foreground">With headings, lists &amp; links</span>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => handleExport("pdf")}
                        className="cursor-pointer gap-2.5 py-2 text-xs"
                      >
                        <div className="flex size-7 items-center justify-center rounded-md bg-rose-500/10 text-rose-500 shrink-0">
                          <File className="size-4" />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-medium text-foreground">PDF Document (.pdf)</span>
                          <span className="text-[10px] text-muted-foreground">Print-ready paginated PDF</span>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onClick={() => handleExport("all")}
                        className="cursor-pointer gap-2.5 py-2 text-xs font-medium"
                      >
                        <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 shrink-0">
                          <Download className="size-4" />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-foreground font-semibold">Export All Formats</span>
                          <span className="text-[10px] text-muted-foreground">Download &amp; save .txt, .md, .pdf</span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Preview PDF Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 cursor-pointer text-xs font-medium h-8 shadow-xs hover:border-primary/50"
                    onClick={() => setPreviewOpen(true)}
                    disabled={!selectedId}
                  >
                    <Eye className="size-3.5 text-primary" />
                    <span>Preview</span>
                  </Button>

                  {/* Deploy Agent Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className={`gap-1.5 cursor-pointer h-8 text-xs font-medium ${
                      deployed.target === "notepad" && deployed.noteContext?.id === selectedId
                        ? "border-primary/60 bg-primary/10 text-primary shadow-xs"
                        : ""
                    }`}
                    onClick={() => {
                      if (deployed.agent && deployed.target === "notepad" && deployed.noteContext?.id === selectedId) {
                        toggleDeployViewMode()
                      } else {
                        setDeployOpen(true)
                      }
                    }}
                    disabled={!selectedId}
                  >
                    {deployed.target === "notepad" && deployed.noteContext?.id === selectedId ? (
                      <>
                        <span className="text-xs">{deployed.agent?.emoji || "🤖"}</span>
                        <span>{deployed.agent?.name} Active</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3.5 text-primary" />
                        <span>Deploy Agent</span>
                      </>
                    )}
                  </Button>

                  {deployed.target === "notepad" && deployed.noteContext?.id === selectedId && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeployOpen(true)}
                      title="Switch or deploy another agent to this note"
                      className="size-8 text-muted-foreground hover:text-primary"
                    >
                      <Sparkles className="size-3.5" />
                    </Button>
                  )}

                  {centered && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setSelectedId(null)}
                      title="Close editor"
                      className="size-8 text-muted-foreground hover:text-primary"
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="px-6 pb-10 pt-4">
                <Notepad key={selectedId} initialContent={content} onChange={handleChange} />
              </div>
            </div>
            </CenteredEditor>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-sm text-muted-foreground p-6">
              <FileText className="size-12 mb-3 opacity-30" />
              <p className="font-medium text-foreground">No Note Selected</p>
              <p className="text-xs text-muted-foreground mt-1">Select a note from the sidebar or click "New note" to start writing.</p>
            </div>
          )}
        </section>
        {researchOpen && selectedId && (
          <ResearchPanel noteId={selectedId} onClose={() => setResearchOpen(false)} />
        )}
      </div>

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete note</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the note and its contents. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              <X className="size-3" /> Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="size-3" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeployAgentPalette
        open={deployOpen}
        onOpenChange={setDeployOpen}
        noteContext={selectedId ? { id: selectedId, title: title || "Untitled", content } : null}
      />

      <NotepadPdfPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={title}
        content={content}
      />
    </div>
  )
}
