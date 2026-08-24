"use client"

import dynamic from "next/dynamic"
import { Brain } from "lucide-react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const Notepad = dynamic(() => import("./Notepad"), {
  ssr: false,
  loading: () => <div className="p-6 text-gray-500">Loading notepad...</div>,
})

export function NotepadSection({ onSaveNote }) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 p-2"
      >
        <Brain className="size-4" /> Notepad
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Dashboard Notes</DialogTitle>
          </DialogHeader>
          <Notepad onChange={onSaveNote} />
        </DialogContent>
      </Dialog>
    </>
  )
}