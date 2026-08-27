"use client"

import { useCallback, useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Rocket, FileText, NotebookPen, PenTool, Lightbulb, Bot, Activity as ActivityIcon } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLiveEvents } from "@/components/providers/event-stream"
import { eventTypeForActivity, sourceForCategory } from "@/lib/events/types"
import type { DomainEvent } from "@/lib/events/types"
import type { Activity } from "@/lib/activities/types"

type Row = {
  id: string
  type: string
  source: string
  title: string
  description: string
  timestamp: string
  entityType?: string
}

function iconForRow(row: Row) {
  if (row.entityType === "idea_map") return Lightbulb
  if (row.entityType === "board") return PenTool
  if (row.entityType === "note") return NotebookPen
  if (row.entityType === "agent_run") return Bot
  switch (row.source) {
    case "ai-venture":
      return Rocket
    case "research-lab":
      return FileText
    case "brainstorm":
      return PenTool
    default:
      return ActivityIcon
  }
}

function toRow(a: Activity): Row {
  return {
    id: a.id,
    type: eventTypeForActivity(a.category, a.action, a.entityType),
    source: sourceForCategory(a.category),
    title: a.title,
    description: a.description,
    timestamp: a.timestamp,
    entityType: a.entityType,
  }
}

function fromEvent(e: DomainEvent): Row {
  return {
    id: e.id,
    type: e.type,
    source: e.source,
    title: e.title,
    description: e.description,
    timestamp: e.timestamp,
    entityType: e.entityType,
  }
}

// Activity scoped to this section. AI Venture writes use the "ai_venture" and
// "concepts" categories; both map to the "ai-venture" source, so we fetch both
// and merge, and watch that source live.
export function AvActivity() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [a, b] = await Promise.all([
        fetch("/api/activities?category=ai_venture&limit=50").then((r) => r.json()),
        fetch("/api/activities?category=concepts&limit=50").then((r) => r.json()),
      ])
      const merged: Row[] = [...(a.activities ?? []), ...(b.activities ?? [])]
        .map(toRow)
        .sort(
          (x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime()
        )
      setRows(merged)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load activity")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const { events } = useLiveEvents({ sources: ["ai-venture"] })

  useEffect(() => {
    if (!events.length) return
    setRows((prev) => {
      const map = new Map(prev.map((r) => [r.id, r]))
      for (const e of events) {
        const row = fromEvent(e)
        map.set(row.id, row)
      }
      return Array.from(map.values()).sort(
        (x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime()
      )
    })
  }, [events])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2">
        <h2 className="text-sm font-medium">Activity</h2>
        <p className="text-xs text-muted-foreground">Work done in this section, newest first.</p>
      </div>
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading activity
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={load} className="text-xs underline">
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-muted-foreground">
          <ActivityIcon className="size-8" />
          <p className="text-sm">No activity here yet.</p>
        </div>
      ) : (
        <ScrollArea className="flex-1" data-lenis-prevent>
          <div className="flex flex-col gap-1 p-3">
            {rows.map((row) => {
              const Icon = iconForRow(row)
              return (
                <div
                  key={row.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{row.title}</p>
                    {row.description ? (
                      <p className="truncate text-xs text-muted-foreground">{row.description}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(row.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
