"use client"

import "@blocknote/core/fonts/inter.css"
import { BlockNoteView } from "@blocknote/mantine"
import "@blocknote/mantine/style.css"
import { useCreateBlockNote } from "@blocknote/react"
import { useRef } from "react"
import { Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"

// BlockNote requires a non-empty array of blocks for `initialContent`.
// An empty string/"[]" must resolve to `undefined` so it loads the default
// empty document instead of throwing.
function parseInitialContent(initialContent) {
  if (!initialContent || initialContent === "[]") return undefined
  try {
    const parsed = JSON.parse(initialContent)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
    return undefined
  } catch {
    return undefined
  }
}

export default function NotionEditor({ onChange, initialContent }) {
  const fileInputRef = useRef(null)

  const uploadFile = async (file) => {
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch("/api/notes/image", { method: "POST", body: formData })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error || "Upload failed")
    }
    const data = await res.json()
    return data.url
  }

  const editor = useCreateBlockNote({
    initialContent: parseInitialContent(initialContent),
    uploadFile,
  })

  const handleInsertImage = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const toastId = toast.loading("Uploading image…")
    try {
      const url = await uploadFile(file)
      editor.insertBlocks(
        [{ type: "image", props: { url, caption: file.name } }],
        editor.getTextCursorPosition().block,
        "after"
      )
      toast.success("Image added", { id: toastId })
    } catch (err) {
      toast.error(err?.message || "Could not add image", { id: toastId })
    }
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleInsertImage}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ImageIcon className="size-3.5" />
          Insert image
        </button>
        <span className="text-xs text-muted-foreground">
          You can also paste or drag &amp; drop an image.
        </span>
      </div>
      <BlockNoteView
        editor={editor}
        theme="light"
        onChange={() => {
          if (onChange) onChange(JSON.stringify(editor.document))
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
