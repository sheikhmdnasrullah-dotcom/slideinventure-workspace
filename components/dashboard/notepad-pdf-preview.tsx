"use client"

/* eslint-disable react-hooks/set-state-in-effect */
// The preview object URL is created/revoked in an effect to align the React
// tree with the external browser object-URL lifecycle; synchronous setState
// here is intentional (same pattern as NotepadView's loadNotes).

import * as React from "react"
import { ZoomIn, ZoomOut, RotateCcw, Loader2, FileWarning, X } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { noteToPdfBlob } from "@/lib/notes/export-note"

const clampZoom = (z: number) => Math.min(4, Math.max(0.25, Number(z.toFixed(2))))

export function NotepadPdfPreview({
  open,
  onOpenChange,
  title,
  content,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  content: string
}) {
  const [url, setUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [zoom, setZoom] = React.useState(1)

  React.useEffect(() => {
    if (!open) {
      setUrl((u) => {
        if (u) URL.revokeObjectURL(u)
        return null
      })
      setError(null)
      setZoom(1)
      return
    }
    let cancelled = false
    setLoading(true)
    noteToPdfBlob(title, content)
      .then((blob) => {
        if (!cancelled) setUrl(URL.createObjectURL(blob))
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to render PDF")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, title, content])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!flex h-[94vh] w-[96vw] max-w-[1100px] flex-col !gap-0 overflow-hidden !rounded-lg !border !border-rule !bg-[var(--surface)] !p-0 shadow-2xl z-[60]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
          <DialogTitle className="truncate text-sm font-medium text-ink-strong">
            PDF Preview — {title || "Untitled"}
          </DialogTitle>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setZoom((z) => clampZoom(z - 0.25))}
              title="Zoom out"
            >
              <ZoomOut className="size-3.5" />
            </Button>
            <span className="w-12 text-center text-xs tabular-nums text-ink-muted">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setZoom(1)}
              title="Reset zoom"
            >
              <RotateCcw className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setZoom((z) => clampZoom(z + 0.25))}
              title="Zoom in"
            >
              <ZoomIn className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 text-muted-foreground hover:text-primary"
              onClick={() => onOpenChange(false)}
              title="Close preview"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <div className="relative flex-1 overflow-auto bg-[var(--surface-2)]/60">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-ink-muted">
              <Loader2 className="size-4 animate-spin" /> Rendering PDF…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-destructive">
              <FileWarning className="size-6" />
              {error}
            </div>
          )}
          {url && !error && (
            <div className="flex min-h-full w-full justify-center p-4">
              <div
                className="shrink-0"
                style={{
                  width: `${zoom * 100}%`,
                  height: `${zoom * 100}%`,
                  minWidth: "100%",
                  minHeight: "100%",
                }}
              >
                <iframe
                  title="PDF preview"
                  src={`${url}#view=FitH&toolbar=1`}
                  className="block h-full w-full border-0 bg-white shadow-xl"
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
