"use client"

import { formatDistanceToNow } from "date-fns"
import { FileText } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Stagger, StaggerItem } from "@/components/system/motion"
import { useKnowledge } from "./use-knowledge"

export function KnowledgeList() {
  const { items, selected, setSelected, searchQuery } = useKnowledge()

  return (
    <ScrollArea className="h-screen">
      <Stagger className="flex flex-col gap-2 p-4 pt-0">
        {items.map((item) => (
          <StaggerItem key={item.id}>
          <button
            className={cn(
              "motion-card flex w-full flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm hover:bg-accent/20",
              selected === item.id && "bg-muted"
            )}
            onClick={() => setSelected(item.id)}
          >
            <div className="flex w-full flex-col gap-1">
              <div className="flex items-center">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <div className="font-semibold line-clamp-1">{item.title}</div>
                </div>
                <div
                  className={cn(
                    "ml-auto text-xs whitespace-nowrap",
                    selected === item.id ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true })}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-[10px]">
                  {item.type}
                </Badge>
                <span className="text-xs text-muted-foreground capitalize">
                  {item.source}
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                  {item.status}
                </span>
              </div>
            </div>
            {item.body && (
              <div className="line-clamp-2 text-xs text-muted-foreground">
                {item.body.substring(0, 200)}
              </div>
            )}
          </button>
          </StaggerItem>
        ))}
        {items.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No knowledge items found
          </div>
        )}
      </Stagger>
    </ScrollArea>
  )
}
