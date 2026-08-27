"use client"

import { useState } from "react"
import { FolderOpen, Sparkles, PenTool, LayoutGrid, NotebookPen } from "lucide-react"
import { AppWindow } from "./app-window"
import { AvFiles } from "./av-files"
import { AvQuery } from "./av-query"
import { AvWhiteboard } from "./av-whiteboard"
import { AvPlayground } from "./av-playground"
import { NotepadView } from "@/components/dashboard/notepad-view"

type ToolId = "files" | "query" | "whiteboard" | "playground" | "notepad"

const TOOLS: { id: ToolId; label: string; description: string; icon: typeof FolderOpen }[] = [
  { id: "files", label: "Files", description: "Upload, organize, and open your PDFs, sheets, images, and docs", icon: FolderOpen },
  { id: "query", label: "Query", description: "Ask anything — grounded in what you've uploaded and written here", icon: Sparkles },
  { id: "whiteboard", label: "Whiteboard", description: "Sketch and brainstorm with Excalidraw or AFFiNE", icon: PenTool },
  { id: "playground", label: "Playground", description: "Every saved board, in one visual library", icon: LayoutGrid },
  { id: "notepad", label: "Notepad", description: "Quick rich-text notes, autosaved", icon: NotebookPen },
]

// AI Venture home: a small, fixed set of large application-style icons
// rather than a table/column-heavy dashboard. Each opens as a large floating
// window over the dashboard (AppWindow) — never a new tab, never a route
// change that would lose the surrounding context.
export function AiVentureWorkspace() {
  const [open, setOpen] = useState<ToolId | null>(null)
  const active = TOOLS.find((t) => t.id === open)

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col items-center justify-center gap-10 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">AI Venture</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your workstation for this venture — pick a tool to get started.</p>
      </div>

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setOpen(tool.id)}
            className="group flex w-36 flex-col items-center gap-3 rounded-2xl p-4 text-center transition-all hover:bg-accent/60 active:scale-[0.97]"
          >
            <div className="flex size-20 items-center justify-center rounded-2xl bg-[var(--surface-2)] shadow-sm ring-1 ring-rule transition-transform group-hover:scale-105 group-hover:shadow-md">
              <tool.icon className="size-9 text-ink-strong" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-sm font-medium">{tool.label}</div>
              <div className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-muted-foreground">{tool.description}</div>
            </div>
          </button>
        ))}
      </div>

      <AppWindow open={!!open} onClose={() => setOpen(null)} title={active?.label ?? ""}>
        {open === "files" && <AvFiles />}
        {open === "query" && <AvQuery />}
        {open === "whiteboard" && <AvWhiteboard />}
        {open === "playground" && <AvPlayground />}
        {open === "notepad" && <NotepadView scope="ai-venture" />}
      </AppWindow>
    </div>
  )
}
