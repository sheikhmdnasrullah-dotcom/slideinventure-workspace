"use client"

import { Tldraw, getSnapshot, loadSnapshot } from "tldraw"
import "tldraw/tldraw.css"
import { useEffect, useRef } from "react"

export default function Whiteboard({ initialData, onChange }) {
  const editorRef = useRef(null)
  const mountedRef = useRef(false)

  const handleMount = (editor) => {
    editorRef.current = editor
    if (initialData) {
      try {
        const snapshot = typeof initialData === "string" ? JSON.parse(initialData) : initialData
        loadSnapshot(editor.store, snapshot)
      } catch {
        // ignore malformed snapshot; start blank
      }
    }
    mountedRef.current = true
  }

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    let timer
    const unlisten = editor.store.listen(
      () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          const snapshot = getSnapshot(editor.store)
          onChange?.(JSON.stringify(snapshot))
        }, 800)
      },
      { source: "user", scope: "document" }
    )
    return () => {
      clearTimeout(timer)
      unlisten()
    }
  }, [onChange])

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <Tldraw onMount={handleMount} />
    </div>
  )
}
