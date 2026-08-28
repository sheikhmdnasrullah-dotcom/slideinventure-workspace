"use client"

/* eslint-disable react-hooks/set-state-in-effect */
// Resetting the edit buffers when `selectedItem` changes is a deliberate
// derived-state sync (switching notes), not an update loop. There is no
// cascading render because these are the only state writes for this id.

import * as React from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { ExternalLink, Trash2 } from "lucide-react"
import { useKnowledge } from "./use-knowledge"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function KnowledgeDisplay() {
  const { selectedItem, saveItem, deleteItem, setSelected } = useKnowledge()
  const [title, setTitle] = React.useState("")
  const [body, setBody] = React.useState("")
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle")
  const [viewMode, setViewMode] = React.useState<"sheet" | "raw">("sheet")
  const [deleting, setDeleting] = React.useState(false)
  const [sourceUrl, setSourceUrl] = React.useState<string | null>(null)
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const skipNextSave = React.useRef(false)

  React.useEffect(() => {
    skipNextSave.current = true
    setTitle(selectedItem?.title ?? "")
    setBody(selectedItem?.body ?? "")
    setStatus("idle")
    setSourceUrl(null)
    if (selectedItem?.document_id) {
      fetch(`/api/documents/${selectedItem.document_id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((doc) => setSourceUrl(doc?.url ?? null))
        .catch(() => {})
    }
    // Only re-sync when switching to a different item, not on every body/title keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem?.id])

  const scheduleSave = React.useCallback(
    (patch: { title?: string; content?: string }) => {
      if (!selectedItem) return
      setStatus("saving")
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        try {
          await saveItem(selectedItem.id, patch)
          setStatus("saved")
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed to save")
          setStatus("idle")
        }
      }, 700)
    },
    [selectedItem, saveItem]
  )

  React.useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    scheduleSave({ title })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  React.useEffect(() => {
    if (skipNextSave.current) return
    scheduleSave({ content: body })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body])

  const handleDelete = async () => {
    if (!selectedItem) return
    if (!confirm(`Delete "${selectedItem.title || "Untitled"}"? This can't be undone.`)) return
    setDeleting(true)
    try {
      await deleteItem(selectedItem.id)
      setSelected(null)
      toast.success("Deleted")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete")
    } finally {
      setDeleting(false)
    }
  }

  if (!selectedItem) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
        No knowledge item selected
      </div>
    )
  }

  const isMirror = Boolean(selectedItem.document_id)

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex flex-col p-6 gap-4">
        <div className="flex items-start justify-between gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-none px-0 text-2xl font-bold shadow-none focus-visible:ring-0"
            placeholder="Untitled"
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
            title="Delete"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{selectedItem.type}</Badge>
          <span className="text-sm text-muted-foreground">
            Source: <span className="capitalize">{selectedItem.source}</span>
          </span>
          <span className="text-sm text-muted-foreground">
            Status: <span className="capitalize">{selectedItem.status}</span>
          </span>
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                <ExternalLink className="size-3" /> Open source file
              </Button>
            </a>
          )}
          {body.includes("|---|") && (
            <div className="ml-2 inline-flex items-center rounded-md border border-rule bg-[var(--surface-2)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("sheet")}
                className={`rounded px-2 py-0.5 font-medium transition-colors ${viewMode === "sheet" ? "bg-background text-ink-strong shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Sheet View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("raw")}
                className={`rounded px-2 py-0.5 font-medium transition-colors ${viewMode === "raw" ? "bg-background text-ink-strong shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Markdown Editor
              </button>
            </div>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {status === "saving" ? "Saving" : status === "saved" ? "Saved" : ""}
          </span>
          {selectedItem.updated_at && (
            <span className="text-sm text-muted-foreground">
              Updated {format(new Date(selectedItem.updated_at), "PPp")}
            </span>
          )}
        </div>
        {isMirror && (
          <p className="text-xs text-muted-foreground italic">
            This entry mirrors a file stored in Documents/AI Venture. Editing the text here won&apos;t change the original file.
          </p>
        )}
      </div>
      <Separator />
      <div className="flex-1 p-6">
        {viewMode === "sheet" && body.includes("|---|") ? (
          <MarkdownTableView content={body} />
        ) : (
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Start writing..."
            className="min-h-[300px] w-full resize-none border-none p-0 font-mono text-sm leading-relaxed shadow-none focus-visible:ring-0"
          />
        )}
      </div>
    </div>
  )
}

function MarkdownTableView({ content }: { content: string }) {
  const lines = content.split("\n");
  const tableStartIndex = lines.findIndex((l) => l.trim().startsWith("|") && l.includes("|---|"));
  
  if (tableStartIndex <= 0) {
    return <div className="whitespace-pre-wrap font-mono text-xs">{content}</div>;
  }

  const headerLine = lines[tableStartIndex - 1];
  const headers = headerLine
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);

  const rowLines = lines.slice(tableStartIndex + 1).filter((l) => l.trim().startsWith("|"));
  const rows = rowLines.map((line) =>
    line
      .split("|")
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
  );

  const preamble = lines.slice(0, tableStartIndex - 1).join("\n").trim();

  return (
    <div className="space-y-4">
      {preamble && (
        <div className="rounded-lg border border-rule bg-muted/20 p-4 text-xs text-ink-muted leading-relaxed whitespace-pre-wrap">
          {preamble}
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-rule bg-card/40 shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-rule bg-muted/50 font-label">
              {headers.map((h, i) => (
                <th key={i} className="px-3.5 py-2.5 text-left font-medium text-ink-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-rule font-body-tight">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-muted/30 transition-colors">
                {row.map((cell, cIdx) => {
                  const isLink = cell.startsWith("[") && cell.includes("](") && cell.endsWith(")");
                  const linkMatch = cell.match(/\[(.*?)\]\((.*?)\)/);

                  return (
                    <td key={cIdx} className="px-3.5 py-2.5 text-ink-strong break-words">
                      {isLink && linkMatch ? (
                        <a
                          href={linkMatch[2]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {linkMatch[1]}
                          <ExternalLink className="size-2.5 opacity-60" />
                        </a>
                      ) : cell.includes("@") && cell.includes(".") ? (
                        <span className="font-mono font-medium text-emerald-500">{cell}</span>
                      ) : (
                        cell.replace(/\*\*/g, "")
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
