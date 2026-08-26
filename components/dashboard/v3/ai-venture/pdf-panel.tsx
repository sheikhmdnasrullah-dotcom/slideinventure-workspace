"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { formatDistanceToNow } from "date-fns"
import { FileText, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// react-pdf/pdfjs-dist reference browser-only globals (e.g. DOMMatrix) at
// module scope — importing it directly crashes the page during SSR. Loading
// it dynamically with ssr disabled keeps it out of the server render entirely.
const PdfViewer = dynamic(() => import("./pdf-viewer").then((m) => m.PdfViewer), { ssr: false })

export type VenturePdf = { id: string; path: string; name: string; size: number; modifiedAt: string }

export function PdfPanel({
  pdfs,
  loading,
  onChanged,
}: {
  pdfs: VenturePdf[]
  loading: boolean
  onChanged: () => void
}) {
  const [openPdf, setOpenPdf] = React.useState<VenturePdf | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(true)
    try {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString("base64")
      const safeName = file.name.replace(/[^\w.-]+/g, "_")
      const res = await fetch("/api/ai-venture/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: `PDF/${safeName}`, content: base64, encoding: "base64" }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to upload PDF")
      }
      toast.success("PDF uploaded")
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload PDF")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (pdf: VenturePdf) => {
    try {
      const res = await fetch(`/api/ai-venture/file?path=${encodeURIComponent(pdf.path)}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      toast.success("PDF deleted")
      if (openPdf?.id === pdf.id) setOpenPdf(null)
      onChanged()
    } catch {
      toast.error("Failed to delete PDF")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">PDFs &amp; Research Material</h2>
        <Button size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Upload PDF
        </Button>
        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted/20" />
          ))}
        </div>
      ) : pdfs.length === 0 ? (
        <Card>
          <CardContent className="flex h-32 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <p className="text-sm">No PDFs yet.</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" /> Upload PDF
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pdfs.map((pdf) => (
            <Card key={pdf.id} className="group cursor-pointer transition-colors hover:bg-accent/30" onClick={() => setOpenPdf(pdf)}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <CardTitle className="truncate text-sm font-medium">{pdf.name}</CardTitle>
                </div>
                <Trash2
                  className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(pdf)
                  }}
                />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {(pdf.size / 1024).toFixed(0)} KB · uploaded {formatDistanceToNow(new Date(pdf.modifiedAt), { addSuffix: true })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {openPdf && (
        <PdfViewer
          documentId={openPdf.id}
          path={openPdf.path}
          name={openPdf.name}
          open={!!openPdf}
          onOpenChange={(o) => !o && setOpenPdf(null)}
          onSavedToResearch={() => {}}
        />
      )}
    </div>
  )
}
