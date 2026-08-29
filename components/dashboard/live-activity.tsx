"use client"

import * as React from "react"
import Link from "next/link"
import { useLiveEvents } from "@/components/providers/event-stream"
import { labelForEventType } from "@/lib/events/types"
import type { DomainEvent } from "@/lib/events/types"
import type { Activity } from "@/lib/activities/types"
import { eventTypeForActivity, sourceForCategory } from "@/lib/events/types"
import { MotionDiv, Ease, Duration } from "@/lib/motion"
import { AnimatePresence } from "framer-motion"
import { StatusBadge } from "@/components/system"
import { Panel } from "@/components/dashboard/panel"

type LiveRow = {
  id: string
  type: string
  source: string
  title: string
  description: string
  timestamp: string
  entityId?: string
  entityType?: string
}

function fromActivity(a: Activity): LiveRow {
  return {
    id: a.id,
    type: eventTypeForActivity(a.category, a.action, a.entityType),
    source: sourceForCategory(a.category),
    title: a.title,
    description: a.description,
    timestamp: a.timestamp,
    entityId: a.entityId,
    entityType: a.entityType,
  }
}

function fromEvent(e: DomainEvent): LiveRow {
  return {
    id: e.id,
    type: e.type,
    source: e.source,
    title: e.title,
    description: e.description,
    timestamp: e.timestamp,
    entityId: e.entityId,
    entityType: e.entityType,
  }
}

function dedupeKey(row: LiveRow): string {
  return `${row.entityId ?? row.id}__${row.type}__${row.timestamp}`
}

const SOURCE_ROUTE: Record<string, string> = {
  notes: "/notepad",
  documents: "/documents",
  knowledge: "/knowledge",
  terminal: "/terminal",
  leads: "/leads",
  chat: "/chat",
  "ai-venture": "/concepts",
  brainstorm: "/brainstorm-sketch",
  links: "/useful-links",
  vault: "/vault",
  integrations: "/integrations",
  agents: "/agents",
  todoist: "/todoist",
  research: "/research",
  "research-lab": "/research-lab",
  ideas: "/ideas",
}

function hrefForRow(row: LiveRow): string {
  if (row.entityType === "idea_map" && row.entityId) return `/ideas?id=${encodeURIComponent(row.entityId)}`
  if (row.entityType === "board" && row.entityId) return `/brainstorm-sketch?id=${encodeURIComponent(row.entityId)}`
  if (row.entityType === "note" && row.entityId) return `/notepad?id=${encodeURIComponent(row.entityId)}`
  if (row.entityType === "research_item") return "/research-lab"
  if (row.entityType === "work_session") return "#stopwatch-section"
  if (row.entityType === "todoist_task") return "/todoist"
  if (row.entityType === "lead") return "/leads"
  if (row.entityType === "document" || row.entityType === "file") return "/documents"
  return SOURCE_ROUTE[row.source] ?? "/activity"
}

function dayHeader(ts: string): string {
  const d = new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000)
  if (Number.isNaN(diff)) return "Activity"
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function groupByDay(rows: LiveRow[]): { header: string; items: LiveRow[] }[] {
  const groups = new Map<string, LiveRow[]>()
  for (const row of rows) {
    const header = dayHeader(row.timestamp)
    if (!groups.has(header)) groups.set(header, [])
    groups.get(header)!.push(row)
  }
  return Array.from(groups.entries()).map(([header, items]) => ({ header, items }))
}

export function LiveActivity() {
  const [initial, setInitial] = React.useState<LiveRow[]>([])
  const [loaded, setLoaded] = React.useState(false)
  const { events, status } = useLiveEvents()

  React.useEffect(() => {
    let active = true
    fetch("/api/activities?limit=25", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!active) return
        const list: Activity[] = Array.isArray(json?.activities) ? json.activities : []
        setInitial(list.map(fromActivity))
      })
      .catch(() => {})
      .finally(() => active && setLoaded(true))
    return () => {
      active = false
    }
  }, [])

  const rows = React.useMemo(() => {
    const map = new Map<string, LiveRow>()
    // Live events are newest-first in the buffer; seed them first so any
    // duplicate of an initial item is overwritten by the live copy.
    for (const e of events) {
      const row = fromEvent(e)
      map.set(dedupeKey(row), row)
    }
    for (const row of initial) {
      const k = dedupeKey(row)
      if (!map.has(k)) map.set(k, row)
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }, [events, initial])

  const groups = React.useMemo(() => groupByDay(rows), [rows])

  return (
    <Panel
      title="Activity"
      action={<ConnectionDot status={status} />}
      bodyClassName="p-0"
    >
      {!loaded ? (
        <p className="px-4 py-8 font-body text-sm text-ink-muted">Loading</p>
      ) : rows.length === 0 ? (
        <div className="px-4 py-8">
          <p className="font-body text-sm text-ink-muted">No activity yet.</p>
          <p className="font-body text-xs text-ink-faint">
            Work done in any section is recorded here automatically.
          </p>
        </div>
      ) : (
        <div data-lenis-prevent className="max-h-[420px] overflow-y-auto">
          <AnimatePresence initial={false}>
            {groups.map((group) => (
              <div key={group.header}>
                <div className="sticky top-0 z-10 border-b border-rule bg-[var(--surface-2)]/90 px-4 py-1.5 font-label text-xs text-ink-faint backdrop-blur-sm">
                  {group.header}
                </div>
                <div className="flex flex-col divide-y divide-rule">
                  {group.items.map((row) => {
                    const href = hrefForRow(row)
                    const time = new Date(row.timestamp).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                    const body = (
                      <MotionDiv
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: Duration.fast, ease: Ease.expo }}
                        className="flex items-baseline gap-3 px-4 py-2 transition-colors hover:bg-[var(--surface-2)]"
                      >
                        <span className="shrink-0 font-mono text-xs tabular-nums text-ink-faint">
                          {time}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-body-tight text-sm text-ink-strong">
                            {row.title}
                          </span>
                          {row.description ? (
                            <span className="block truncate font-body text-xs text-ink-muted">
                              {row.description}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 font-label text-xs text-ink-faint">
                          {labelForEventType(row.type)}
                        </span>
                      </MotionDiv>
                    )
                    return href !== "/activity" ? (
                      <Link key={row.id} href={href} className="block">
                        {body}
                      </Link>
                    ) : (
                      <div key={row.id}>{body}</div>
                    )
                  })}
                </div>
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </Panel>
  )
}

function ConnectionDot({ status }: { status: "connecting" | "live" | "offline" }) {
  const live = status === "live"
  return (
    <StatusBadge
      tone={live ? "live" : status === "connecting" ? "warn" : "danger"}
      dot
      label={live ? "Live" : "Reconnecting"}
    />
  )
}
