"use client"

import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useDocuments } from "./use-documents"
import { FileText } from "lucide-react"
import { Stagger, StaggerItem } from "@/components/system/motion"

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentList() {
  const { documents, selected, setSelected, search } = useDocuments()

  const filtered = documents.filter((doc) => {
    if (search && !doc.title.toLowerCase().includes(search.toLowerCase()) && !doc.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))) {
      return false
    }
    return true
  })

  return (
    <ScrollArea className="h-screen">
      <Stagger className="flex flex-col gap-2 p-4 pt-0">
        {filtered.map((item) => (
          <StaggerItem key={item.id}>
          <button
            className={cn(
              "motion-card flex w-full flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm hover:bg-accent",
              selected === item.id && "bg-muted"
            )}
            onClick={() => setSelected(item.id)}
          >
            <div className="flex w-full flex-col gap-1">
              <div className="flex items-center">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <div className="font-semibold">{item.title}</div>
                </div>
                <div
                  className={cn(
                    "ml-auto text-xs",
                    selected === item.id ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </div>
              </div>
              <div className="text-xs font-medium">{formatSize(item.size_bytes)}</div>
            </div>
            <div className="line-clamp-2 text-xs text-muted-foreground">
              {item.filename}
            </div>
            {item.tags.length > 0 && (
              <div className="flex items-center gap-2 mt-1">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </button>
          </StaggerItem>
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No documents found
          </div>
        )}
      </Stagger>
    </ScrollArea>
  )
}
