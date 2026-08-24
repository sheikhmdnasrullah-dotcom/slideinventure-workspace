"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { format } from "date-fns"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Copy, Download, Eye, FileCode, Pencil, Save, Search, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useAIVenture } from "./use-ai-venture"

// Tldraw touches browser-only APIs, so load it client-side only.
const BrainstormCanvas = dynamic(
  () => import("./brainstorm-canvas").then((m) => m.BrainstormCanvas),
  { ssr: false }
)

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 text-foreground">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

export function AIVentureDisplay() {
  const { selectedFile, fileLoading, saveFileContent, brainstormOpen } = useAIVenture()
  const [mode, setMode] = React.useState<"preview" | "raw">("preview")
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [inFileQuery, setInFileQuery] = React.useState("")

  React.useEffect(() => {
    setEditing(false)
    setInFileQuery("")
    setMode("preview")
  }, [selectedFile?.path])

  // Brainstorm mode: always show a fresh canvas.
  if (brainstormOpen) {
    return (
      <div className="h-full w-full">
        <BrainstormCanvas />
      </div>
    )
  }

  if (fileLoading) {
    return <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">Loading file...</div>
  }

  if (!selectedFile) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
        Select a file to view its contents, or start a brainstorm.
      </div>
    )
  }

  const isPdf = selectedFile.name.toLowerCase().endsWith(".pdf")
  const isMarkdown = selectedFile.name.toLowerCase().endsWith(".md")
  const isTldr = selectedFile.name.toLowerCase().endsWith(".tldr") || selectedFile.name.toLowerCase().endsWith(".json")

  // Tldraw snapshot file: open in the editable canvas.
  if (isTldr) {
    return (
      <div className="h-full w-full">
        <BrainstormCanvas
          initialContent={selectedFile.content}
          fileName={selectedFile.name.replace(/\.(tldr|json)$/i, "")}
        />
      </div>
    )
  }

  const matchCount = inFileQuery.trim()
    ? (selectedFile.content.toLowerCase().match(new RegExp(inFileQuery.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length
    : 0

  const handleCopy = async () => {
    await navigator.clipboard.writeText(selectedFile.content)
    toast.success("Copied to clipboard")
  }

  const handleDownload = () => {
    const blob = new Blob([selectedFile.content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = selectedFile.name
    a.click()
    URL.revokeObjectURL(url)
  }

  const startEditing = () => {
    setDraft(selectedFile.content)
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveFileContent(selectedFile.path, draft)
      setEditing(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex flex-col gap-3 p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold">{selectedFile.name}</h1>
            <span className="text-xs text-muted-foreground">/{selectedFile.path}</span>
          </div>
          <div className="flex items-center gap-1">
            {!editing ? (
              <>
                {isMarkdown && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    title={mode === "preview" ? "View raw" : "View preview"}
                    onClick={() => setMode(mode === "preview" ? "raw" : "preview")}
                  >
                    {mode === "preview" ? <FileCode className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="size-8" title="Copy" onClick={handleCopy}>
                  <Copy className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" title="Download" onClick={handleDownload}>
                  <Download className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" title="Edit" onClick={startEditing}>
                  <Pencil className="size-4" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="icon" className="size-8" title="Cancel" onClick={() => setEditing(false)}>
                  <X className="size-4" />
                </Button>
                <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
                  <Save className="size-4" />
                  Save
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{selectedFile.name.split(".").pop()?.toUpperCase()}</Badge>
          <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
          <span className="ml-auto">Modified {format(new Date(selectedFile.modifiedAt), "PPp")}</span>
        </div>
        {!editing && !isPdf && (
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search in file..."
              className="pl-8"
              value={inFileQuery}
              onChange={(e) => setInFileQuery(e.target.value)}
            />
            {inFileQuery.trim() && (
              <span className="absolute right-2 top-2.5 text-xs text-muted-foreground">{matchCount} match{matchCount === 1 ? "" : "es"}</span>
            )}
          </div>
        )}
      </div>
      <Separator />
      <div className="flex-1 p-6">
        {editing ? (
          <Textarea
            className="min-h-[400px] font-mono text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        ) : isPdf ? (
          <iframe
            src={`/api/ai-venture/file/raw?path=${encodeURIComponent(selectedFile.path)}`}
            className="h-full w-full rounded-md border"
            title={selectedFile?.name}
          />
        ) : isMarkdown && mode === "preview" ? (
          <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-a:text-primary prose-pre:bg-muted prose-pre:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedFile.content}</ReactMarkdown>
          </div>
        ) : (
          <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {highlight(selectedFile.content, inFileQuery)}
          </div>
        )}
      </div>
    </div>
  )
}
