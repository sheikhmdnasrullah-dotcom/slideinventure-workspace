"use client"

import * as React from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  Search,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { STIRLING_PDF_URL } from "@/lib/pdf-editor"

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()

export function PdfViewer({
  documentId,
  path,
  name,
  open,
  onOpenChange,
  onSavedToResearch,
}: {
  documentId: string
  path: string
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSavedToResearch: () => void
}) {
  const [numPages, setNumPages] = React.useState(0)
  const [pageNumber, setPageNumber] = React.useState(1)
  const [scale, setScale] = React.useState(1.1)
  const [fitWidth, setFitWidth] = React.useState(true)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [findQuery, setFindQuery] = React.useState("")
  const [finding, setFinding] = React.useState(false)
  const pdfRef = React.useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = React.useState(800)

  const [question, setQuestion] = React.useState("")
  const [asking, setAsking] = React.useState(false)
  const [answer, setAnswer] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setPageNumber(1)
      setAnswer(null)
      setQuestion("")
    }
  }, [open])

  React.useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fileUrl = `/api/ai-venture/file/raw?path=${encodeURIComponent(path)}`

  const handleFind = async () => {
    const q = findQuery.trim().toLowerCase()
    const pdf = pdfRef.current
    if (!q || !pdf) return
    setFinding(true)
    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const text = await page.getTextContent()
        const pageText = text.items.map((it) => ("str" in it ? it.str : "")).join(" ").toLowerCase()
        if (pageText.includes(q)) {
          setPageNumber(i)
          toast.success(`Found on page ${i}`)
          return
        }
      }
      toast.error("Not found in this document")
    } finally {
      setFinding(false)
    }
  }

  const handleAsk = async () => {
    if (!question.trim()) return
    setAsking(true)
    setAnswer(null)
    try {
      const res = await fetch("/api/ai-venture/pdf-ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, question }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || "Failed to ask")
      setAnswer(data.answer)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to ask AI")
    } finally {
      setAsking(false)
    }
  }

  const handleSaveToResearch = async (text: string) => {
    setSaving(true)
    try {
      const listRes = await fetch("/api/research?scope=ai-venture")
      const listData = await listRes.json().catch(() => ({ workspaces: [] }))
      let workspaceId: string | undefined = listData.workspaces?.[0]?.id
      if (!workspaceId) {
        const createRes = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "ai-venture" }),
        })
        const created = await createRes.json()
        workspaceId = created.workspace?.id
      }
      if (!workspaceId) throw new Error("Could not open Research Lab")
      sessionStorage.setItem(
        "research-lab-pending-capture",
        JSON.stringify({ workspaceId, text: `From "${name}":\n\n${text}` })
      )
      toast.success("Saved — open Research Lab to see it on the canvas")
      onSavedToResearch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save to Research Lab")
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = () => {
    const a = document.createElement("a")
    a.href = fileUrl
    a.download = name
    a.click()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`flex flex-col overflow-hidden p-0 ${fullscreen ? "h-screen max-h-screen w-screen max-w-none" : "h-[92vh] max-h-[92vh] w-[95vw] max-w-[1300px]"}`}
        showCloseButton={false}
      >
        <div className="flex items-center gap-2 border-b bg-background px-4 py-2.5">
          <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)} aria-label="Close">
            <ArrowLeft className="size-4" />
          </Button>
          <span className="truncate text-sm font-semibold">{name}</span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setPageNumber((p) => Math.max(1, p - 1))} disabled={pageNumber <= 1}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="w-16 text-center text-xs text-muted-foreground">
              {pageNumber} / {numPages || "…"}
            </span>
            <Button variant="ghost" size="icon-sm" onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages}>
              <ChevronRight className="size-4" />
            </Button>
            <div className="mx-1 h-5 w-px bg-border" />
            <Button variant="ghost" size="icon-sm" onClick={() => { setFitWidth(false); setScale((s) => Math.max(0.4, s - 0.15)) }}>
              <ZoomOut className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setFitWidth((v) => !v)}>
              {fitWidth ? "Fit width" : `${Math.round(scale * 100)}%`}
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => { setFitWidth(false); setScale((s) => Math.min(3, s + 0.15)) }}>
              <ZoomIn className="size-4" />
            </Button>
            <div className="mx-1 h-5 w-px bg-border" />
            <Button variant="ghost" size="icon-sm" onClick={() => setFullscreen((v) => !v)}>
              {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={handleDownload}>
              <Download className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => window.open(STIRLING_PDF_URL, "_blank", "noopener,noreferrer")}
              title="Edit in Stirling-PDF (opens in a new tab)"
            >
              <Pencil className="size-4" /> Edit
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
          <Search className="size-3.5 text-muted-foreground" />
          <Input
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFind()}
            placeholder="Find in this PDF…"
            className="h-7 max-w-xs text-xs"
          />
          {finding && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex min-h-0 flex-1">
          <ScrollArea className="flex-1">
            <div ref={containerRef} className="flex justify-center p-6">
              <Document
                file={fileUrl}
                onLoadSuccess={(pdf) => {
                  pdfRef.current = pdf
                  setNumPages(pdf.numPages)
                }}
                onLoadError={() => toast.error("Failed to load PDF")}
                loading={<div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading PDF…</div>}
              >
                <Page
                  pageNumber={pageNumber}
                  width={fitWidth ? Math.min(containerWidth - 48, 1000) : undefined}
                  scale={fitWidth ? undefined : scale}
                />
              </Document>
            </div>
          </ScrollArea>
          <aside className="w-80 shrink-0 border-l p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="size-4" /> Ask about this PDF
              </div>
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                placeholder="What are the key opportunities here?"
                className="h-8 text-sm"
              />
              <Button size="sm" className="gap-1.5" onClick={handleAsk} disabled={asking || !question.trim()}>
                {asking ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                {asking ? "Thinking…" : "Ask"}
              </Button>
              {answer && (
                <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="whitespace-pre-wrap leading-relaxed">{answer}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 self-start"
                    onClick={() => handleSaveToResearch(answer)}
                    disabled={saving}
                  >
                    Save to Research
                  </Button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}
