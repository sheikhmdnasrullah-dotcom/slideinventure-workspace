"use client"

import "@blocknote/core/fonts/inter.css"
import { BlockNoteView } from "@blocknote/mantine"
import "@blocknote/mantine/style.css"
import { useCreateBlockNote } from "@blocknote/react"

export default function Notepad({ onChange, initialContent, document }) {
  const editor = useCreateBlockNote({
    initialContent: document ? JSON.parse(document) : initialContent ? JSON.parse(initialContent) : undefined,
  })

  return (
    <div className="w-full min-h-[400px] px-4 py-2">
      <BlockNoteView
        editor={editor}
        theme="light"
        onChange={() => {
          if (onChange) {
            onChange(JSON.stringify(editor.document))
          }
        }}
      />
    </div>
  )
}