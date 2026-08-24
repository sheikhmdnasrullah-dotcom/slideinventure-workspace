"use client"

import React from "react"
import dynamic from "next/dynamic"
import { Brain, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export interface BrainstormSketchProps {
  onSaveBoard?: (elements: any, state: any) => void
  onSaveNote?: (json: string) => void
  boardId?: string
}

export function BrainstormSketch({ onSaveBoard, onSaveNote, boardId }: BrainstormSketchProps) {
  const [openBoard, setOpenBoard] = React.useState(false)
  const [openNote, setOpenNote] = React.useState(false)

  return (
    <div className="flex flex-col gap-4">
      {/* Brainstorm Sketch Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpenBoard(true)}
        className="hover:bg-brainstorm"
      >
        <Sparkles className="size-4" />
      </Button>

      {/* Notepad Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpenNote(true)}
        className="hover:bg-muted"
      >
        <Brain className="size-4" />
      </Button>

      {/* Modal for Brainboard */}
      <Dialog open={openBoard} onOpenChange={setOpenBoard}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Brainstorm Sketch</DialogTitle>
          </DialogHeader>
          <div className="h-[500px] w-full">
            <Whiteboard
              boardId={boardId ?? "dashboard-brainstorm-1"}
              onChange={onSaveBoard}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal for Notepad */}
      <Dialog open={openNote} onOpenChange={setOpenNote}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Dashboard Notes</DialogTitle>
          </DialogHeader>
          <div className="h-[400px] w-full">
            <NoteEditor onChange={onSaveNote} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}