"use client"

import { Tldraw, getSnapshot, loadSnapshot } from "tldraw"
import "tldraw/tldraw.css"
import { useEffect, useRef } from "react"

// A single, stable tldraw editor per mounted instance. The parent is expected
// to give this component a `key` that is the board id, so switching boards
// remounts the editor with the correct snapshot instead of reusing another
// board's store (which would leak data across boards).
export default function Whiteboard({ boardId, initialData, onChange, onMount }) {
  const editorRef = useRef(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onMountRef = useRef(onMount)
  onMountRef.current = onMount

  const handleMount = (editor) => {
    editorRef.current = editor
    try {
      const snapshot = typeof initialData === "string" ? JSON.parse(initialData) : initialData
      if (snapshot && typeof snapshot === "object" && Object.keys(snapshot).length > 0) {
        loadSnapshot(editor.store, snapshot)
      }
    } catch {
      // ignore malformed snapshot; start blank
    }
    onMountRef.current?.(editor)
  }

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    let timer
    const unlisten = editor.store.listen(
      () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          try {
            const snapshot = getSnapshot(editor.store)
            onChangeRef.current?.(JSON.stringify(snapshot))
          } catch {
            // ignore transient serialization errors
          }
        }, 700)
      },
      { source: "user", scope: "document" }
    )
    return () => {
      clearTimeout(timer)
      unlisten()
    }
    // Subscribe once on mount; onChange is read through a ref so the listener
    // never needs to be torn down and re-created on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ height: "100%", width: "100%" }} className="tldraw-host">
      <Tldraw onMount={handleMount} />
    </div>
  )
}
