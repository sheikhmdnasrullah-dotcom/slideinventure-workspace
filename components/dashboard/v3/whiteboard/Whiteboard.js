"use client"

import { Excalidraw } from "@excalidraw/excalidraw"
import "@excalidraw/excalidraw/index.css"
import { useEffect, useRef, useState } from "react"

// A single, stable Excalidraw instance per mounted instance. The parent is
// expected to give this component a `key` that is the board id, so switching
// boards remounts the editor with the correct snapshot instead of reusing
// another board's scene (which would leak data across boards).
//
// `onMount` receives Excalidraw's imperative API object (not a class
// instance like tldraw's Editor). Callers use `.getSceneElements()`,
// `.updateScene()`, `.getAppState()`, etc. See the Excalidraw docs for the
// full ExcalidrawImperativeAPI surface.
export default function Whiteboard({ initialData, onChange, onMount }) {
  const onChangeRef = useRef(onChange)
  const onMountRef = useRef(onMount)
  const [initialState] = useState(() => {
    try {
      const data = typeof initialData === "string" ? JSON.parse(initialData) : initialData
      if (data && typeof data === "object" && Array.isArray(data.elements)) {
        return {
          elements: data.elements,
          appState: {
            viewBackgroundColor: data.appState?.viewBackgroundColor ?? "#ffffff",
            scrollX: data.appState?.scrollX ?? 0,
            scrollY: data.appState?.scrollY ?? 0,
            zoom: data.appState?.zoom ?? { value: 1 },
          },
        }
      }
    } catch {
      // ignore malformed snapshot; start blank
    }
    return undefined
  })

  useEffect(() => {
    onChangeRef.current = onChange
    onMountRef.current = onMount
  }, [onChange, onMount])

  const timerRef = useRef(undefined)

  const handleChange = (elements, appState) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      try {
        const snapshot = JSON.stringify({
          elements,
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor,
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
            zoom: appState.zoom,
          },
        })
        onChangeRef.current?.(snapshot)
      } catch {
        // ignore transient serialization errors
      }
    }, 700)
  }

  return (
    <div style={{ height: "100%", width: "100%" }} className="excalidraw-host">
      <Excalidraw
        initialData={initialState}
        onChange={handleChange}
        excalidrawAPI={(api) => onMountRef.current?.(api)}
      />
    </div>
  )
}
