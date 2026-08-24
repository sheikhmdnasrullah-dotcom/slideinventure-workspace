"use client"

import * as React from "react"
import { Tldraw, getSnapshot, loadSnapshot, type Editor, type TLStoreSnapshot } from "tldraw"
import "tldraw/tldraw.css"
import { Button } from "@/components/ui/button"
import { Download, X } from "lucide-react"
import { useAIVenture } from "./use-ai-venture"
import { toast } from "sonner"

export function BrainstormCanvas({
  initialContent,
  fileName,
}: {
  initialContent?: string
  fileName?: string
}) {
  const editorRef = React.useRef<Editor | null>(null)
  const { exportBrainstorm, closeBrainstorm } = useAIVenture()

  const handleMount = React.useCallback(
    (editor: Editor) => {
      editorRef.current = editor
      if (initialContent) {
        try {
          const snapshot = JSON.parse(initialContent) as TLStoreSnapshot
          loadSnapshot(editor.store, snapshot)
        } catch {
          // If the snapshot is malformed, just start with a blank canvas.
        }
      }
    },
    [initialContent]
  )

  const handleExport = async () => {
    const editor = editorRef.current
    if (!editor) return
    const snapshot = getSnapshot(editor.store)
    const name = fileName || `Brainstorm ${new Date().toISOString().slice(0, 10)}`
    try {
      await exportBrainstorm(JSON.stringify(snapshot), name)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed")
    }
  }

  return (
    <div className="relative h-full w-full">
      <Tldraw onMount={handleMount} />
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
