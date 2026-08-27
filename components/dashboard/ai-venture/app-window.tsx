"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

// A large, centered floating window over the dashboard — used by every AI
// Venture tool (Files, Query, Whiteboard, Playground, Notepad) instead of a
// new tab/window or a slide-in side panel. The dashboard behind it stays
// mounted and untouched; closing this never navigates anywhere.
export function AppWindow({
  open,
  onClose,
  title,
  headerExtra,
  children,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  headerExtra?: React.ReactNode
  children: React.ReactNode
}) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px] duration-150 animate-in fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={cn(
          "flex h-[88vh] w-[92vw] max-w-[1400px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl",
          "duration-150 animate-in zoom-in-95 slide-in-from-bottom-2"
        )}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
          <div className="min-w-0 flex-1 text-sm font-medium">{title}</div>
          {headerExtra}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  )
}
