"use client"

import { format } from "date-fns"
import { useKnowledge } from "./use-knowledge"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

export function KnowledgeDisplay() {
  const { selectedItem } = useKnowledge()

  if (!selectedItem) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
        No knowledge item selected
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex flex-col p-6 gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">{selectedItem.title}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{selectedItem.type}</Badge>
            <span className="text-sm text-muted-foreground">
              Source: <span className="capitalize">{selectedItem.source}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              Status: <span className="capitalize">{selectedItem.status}</span>
            </span>
            {selectedItem.updated_at && (
              <span className="ml-auto text-sm text-muted-foreground">
                Updated {format(new Date(selectedItem.updated_at), "PPp")}
              </span>
            )}
          </div>
        </div>
      </div>
      <Separator />
      <div className="flex-1 p-6">
        {selectedItem.body ? (
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {selectedItem.body}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic">No content body</div>
        )}
      </div>
    </div>
  )
}
