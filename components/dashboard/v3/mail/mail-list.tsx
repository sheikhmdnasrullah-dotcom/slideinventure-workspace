"use client"

import { type ComponentProps } from "react"
import { formatDistanceToNow } from "date-fns"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

import { useMail } from "./use-mail"
import type { MailMessage } from "@/lib/mail/types"

interface MailListProps {
  unreadOnly?: boolean
}

export function MailList({ unreadOnly = false }: MailListProps) {
  const { messages, loading, error, selected, setSelected, markRead } = useMail()

  const items = unreadOnly ? messages.filter((m) => !m.read) : messages

  if (loading && items.length === 0) {
    return (
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-2 p-4 pt-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </ScrollArea>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium text-destructive">Failed to load messages</p>
        <p className="mt-1 text-xs">{error}</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No messages
      </div>
    )
  }

  return (
    <ScrollArea className="h-screen">
      <div className="flex flex-col gap-2 p-4 pt-0">
        {items.map((item) => (
          <button
            key={item.id}
            className={cn(
              "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent",
              selected === item.id && "bg-muted"
            )}
            onClick={() => {
              setSelected(item.id)
              if (!item.read) markRead(item.id, true).catch(console.error)
            }}
          >
            <div className="flex w-full flex-col gap-1">
              <div className="flex items-center">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{item.fromName || item.from}</div>
                  {!item.read && (
                    <span className="flex h-2 w-2 rounded-full bg-blue-600" />
                  )}
                </div>
                <div
                  className={cn(
                    "ml-auto text-xs",
                    selected === item.id ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                </div>
              </div>
              <div className="text-xs font-medium">{item.subject}</div>
            </div>
            <div className="line-clamp-2 text-xs text-muted-foreground">
              {item.text?.substring(0, 300)}
            </div>
            {item.labels.length > 0 && (
              <div className="flex items-center gap-2">
                {item.labels.map((label) => (
                  <Badge key={label} variant={getBadgeVariant(label)}>
                    {label}
                  </Badge>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}

function getBadgeVariant(
  label: string
): ComponentProps<typeof Badge>["variant"] {
  if (["work"].includes(label.toLowerCase())) return "default"
  if (["personal"].includes(label.toLowerCase())) return "outline"
  return "secondary"
}
