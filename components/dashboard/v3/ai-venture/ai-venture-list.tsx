"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import { Folder, MoreVertical, FileText, FileType } from "lucide-react"
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function NodeIcon({ node }: { node: VentureNode }) {
  if (node.type === "folder") return <Folder className="size-4 text-muted-foreground" />
  if (node.ext === ".md") return <FileText className="size-4 text-muted-foreground" />
  return <FileType className="size-4 text-muted-foreground" />
}

export function AIVentureList() {
  const { entries, selectedPath, navigateTo, selectFile, renameEntry, deleteEntry } = useAIVenture()

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
    <ScrollArea className="h-screen">
      <div className="flex flex-col gap-2 p-4 pt-0">
        {entries.map((node) => (
          <div
            key={node.path}
            className={cn(
              "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent/20",
              selectedPath === node.path && "bg-muted"
            )}
          >
            <button className="flex flex-1 items-center gap-2 text-left" onClick={() => handleOpen(node)}>
              <NodeIcon node={node} />
              <span className="font-medium line-clamp-1">{node.name}</span>
            </button>
            {node.type === "file" && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">{formatSize(node.size)}</span>
            )}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(node.modifiedAt), { addSuffix: true })}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" className="size-7 shrink-0" />}
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleRename(node)}>Rename</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDelete(node)} variant="destructive">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">This folder is empty</div>
        )}
      </div>
    </ScrollArea>
  )
}
