"use client"

import "@blocknote/core/fonts/inter.css"
import { BlockNoteView } from "@blocknote/mantine"
import "@blocknote/mantine/style.css"
import { useCreateBlockNote } from "@blocknote/react"

export default function NotionEditor({ onChange, initialContent }) {
  // Initialize the editor instance
  const editor = useCreateBlockNote({
    initialContent: initialContent ? JSON.parse(initialContent) : undefined,
  })

  return (
    <div className="w-full min-h-[400px] px-4 py-2">
      <BlockNoteView
        editor={editor}
        theme="light" // or "dark", or omit to match system
        onChange={() => {
          // editor.document contains the JSON array of your blocks
          if (onChange) {
            onChange(JSON.stringify(editor.document))
          }
        }}
      />
    </div>
  )
}