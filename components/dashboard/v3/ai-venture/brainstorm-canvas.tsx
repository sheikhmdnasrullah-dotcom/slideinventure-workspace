"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types"
import { Button } from "@/components/ui/button"
import { Download, X } from "lucide-react"
import { useAIVenture } from "./use-ai-venture"
import { toast } from "sonner"

// Reuses the same shared Excalidraw wrapper as Research Lab and Brainstorm
// Sketch, rather than a second bespoke canvas mount — its `onChange` is
// unused here since this view saves via an explicit Export action instead
// of autosave.
const Whiteboard = dynamic(() => import("@/components/dashboard/v3/whiteboard/Whiteboard"), {
  ssr: false,
}) as unknown as React.ComponentType<{
  initialData?: string
  onChange: (data: string) => void
  onMount: (api: ExcalidrawImperativeAPI) => void
}>

export function BrainstormCanvas({
  initialContent,
  fileName,
}: {
  initialContent?: string
  fileName?: string
}) {
  const editorRef = React.useRef<ExcalidrawImperativeAPI | null>(null)
  const { exportBrainstorm, closeBrainstorm } = useAIVenture()

  const handleExport = async () => {
    const api = editorRef.current
    if (!api) return
    const appState = api.getAppState()
    const snapshot = {
      elements: api.getSceneElements(),
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        zoom: appState.zoom,
      },
    }
    const name = fileName || `Brainstorm ${new Date().toISOString().slice(0, 10)}`
    try {
      await exportBrainstorm(JSON.stringify(snapshot), name)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed")
    }
  }

  return (
    <div className="min-h-[600px] min-w-full relative">
      <Whiteboard
        initialData={initialContent}
        onChange={() => {}}
        onMount={(api) => {
          editorRef.current = api
        }}
      />
      <div className="absolute right-3 top-3 z-50 flex items-center gap-2">
        <Button
          size="icon"
          className="size-9 rounded-full bg-[var(--accent-vivid)] text-[var(--on-accent)] shadow-lg transition-transform hover:scale-105"
          title="Export to Brainstormed Ideas"
          onClick={handleExport}
        >
          <Download className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="size-9 rounded-full shadow-lg"
          title="Close brainstorm"
          onClick={closeBrainstorm}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}
