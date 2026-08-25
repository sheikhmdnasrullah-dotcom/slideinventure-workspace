"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import { Folder, FolderPlus, MoreVertical, FileText, FileType, FileJson, Brain, Sparkles, Trash2, Pencil } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAIVenture, type VentureNode } from "./use-ai-venture"

function NodeIcon({ node }: { node: VentureNode }) {
  if (node.type === "folder") {
    const lower = node.name.toLowerCase()
    if (lower === "brainstorm" || lower === "brainstormed ideas") return <Brain className="size-8 text-primary" />
    if (lower === "brainstorm sketches") return <Sparkles className="size-8 text-primary" />
    if (lower === "pdf") return <FileType className="size-8 text-primary" />
    return <Folder className="size-8 text-amber-500" />
  }
  if (node.ext === ".md") return <FileText className="size-8 text-sky-600" />
  if (node.ext === ".pdf") return <FileType className="size-8 text-red-500" />
  if (node.ext === ".tldr" || node.ext === ".json") return <FileJson className="size-8 text-violet-500" />
  return <FileType className="size-8 text-muted-foreground" />
}

export function AIVentureList() {
  const { entries, navigateTo, selectFile, renameEntry, deleteEntry } = useAIVenture()

  const handleOpen = (node: VentureNode) => {
    if (node.type === "folder") navigateTo(node.path)
    else selectFile(node.path)
  }

  const handleRename = async (node: VentureNode) => {
    const next = window.prompt("Rename to:", node.name)
    if (!next || next === node.name) return
    try {
      await renameEntry(node, next)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to rename")
    }
  }

  const handleDelete = async (node: VentureNode) => {
    const ok = window.confirm(`Delete "${node.name}"? This cannot be undone.`)
    if (!ok) return
    try {
      await deleteEntry(node)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete")
    }
  }

  return (
    <ScrollArea className="h-full">
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {entries.map((node) => (
          <div
            key={node.path}
            className="group relative flex flex-col items-center gap-2 rounded-xl border border-transparent p-3 text-center transition-all hover:border-border hover:bg-accent/30"
          >
            <button className="flex w-full flex-col items-center gap-2" onClick={() => handleOpen(node)}>
              <div className="flex size-16 items-center justify-center rounded-2xl bg-muted/60 shadow-sm transition-transform group-hover:scale-105">
                <NodeIcon node={node} />
              </div>
              <span className="line-clamp-2 text-xs font-medium">{node.name}</span>
            </button>
            <span className="text-[10px] text-muted-foreground">
              {node.type === "file"
                ? `${(node.size / 1024).toFixed(0)} KB`
                : formatDistanceToNow(new Date(node.modifiedAt), { addSuffix: true })}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" className="absolute right-1 top-1 size-7 opacity-0 group-hover:opacity-100" />}
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleRename(node)}>
                  <Pencil className="mr-2 size-4" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDelete(node)} variant="destructive">
                  <Trash2 className="mr-2 size-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="col-span-full p-8 text-center text-sm text-muted-foreground">This folder is empty</div>
        )}
      </div>
    </ScrollArea>
  )
}
