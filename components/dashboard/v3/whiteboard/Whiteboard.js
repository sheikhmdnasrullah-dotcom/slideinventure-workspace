"use client"

import { Tldraw } from "tldraw"
import "tldraw/tldraw.css"
import { useState } from "react"

export default function Whiteboard({ initialData, onChange }) {
  const [api, setApi] = useState(null)

  const handleSceneChange = (elements, state) => {
    if (onChange) {
      onChange(elements, state)
    }
  }

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <Tldraw
        onChange={handleSceneChange}
        onMount={(tldrawApi) => setApi(tldrawApi)}
        initialData={initialData ? { pages: [{ elements: initialData }] } : { pages: [] }}
      />
    </div>
  )
}