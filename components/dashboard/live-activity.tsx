"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { useLiveEvents } from "@/components/providers/event-stream"
import { labelForEventType } from "@/lib/events/types"
import type { DomainEvent } from "@/lib/events/types"
import type { Activity } from "@/lib/activities/types"
import { eventTypeForActivity, sourceForCategory } from "@/lib/events/types"
import { MotionDiv, Ease, Duration } from "@/lib/motion"
import { AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  FileText,
  NotebookPen,
  Terminal,
  Link2,
  MessageSquare,
  Rocket,
  CheckCircle2,
  LibraryBig,
  Users,
  Beaker,
  Sparkles,
  Lightbulb,
  FileCode2,
  Bot,
  Plus,
  Command,
  type LucideIcon,
} from "lucide-react"
import { commandMenuStore } from "@/lib/command-menu-store"
import { StatusBadge } from "@/components/system"
import { Button } from "@/components/ui/button"

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

const SOURCE_ICON: Record<string, LucideIcon> = {
  notes: NotebookPen,
  documents: FileText,
  knowledge: LibraryBig,
  terminal: Terminal,
  leads: Users,
  chat: MessageSquare,
  "ai-venture": Rocket,
  brainstorm: Lightbulb,
  links: Link2,
  vault: CheckCircle2,
  integrations: Link2,
  agents: Bot,
  todoist: CheckCircle2,
  research: Beaker,
  "research-lab": Beaker,
  ideas: Sparkles,
  system: FileCode2,
  dashboard: FileCode2,
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

function iconForSource(source: string): LucideIcon {
  return SOURCE_ICON[source] ?? FileCode2
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
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 pb-3">
        <div>
          <p className="font-label text-ink-faint">Recent activity</p>
          <p className="font-body-tight text-sm text-ink-muted">What happened while you were away</p>
        </div>
        <ConnectionDot status={status} />
      </div>
      {!loaded ? (
        <div className="flex h-[360px] items-center justify-center font-body text-sm text-ink-muted">
          Loading activity
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center font-body text-sm text-ink-muted">
          No activity yet. Work done in any section shows up here.
        </p>
      ) : (
        <div data-lenis-prevent className="h-[360px] overflow-y-auto pr-2">
          <AnimatePresence initial={false}>
            {groups.map((group) => (
              <div key={group.header} className="mb-1">
                <div className="sticky top-0 z-10 bg-[var(--page-fill)]/90 py-1 font-label text-ink-faint backdrop-blur-sm">
                  {group.header}
                </div>
                <div className="flex flex-col">
                  {group.items.map((row) => {
                    const Icon = iconForSource(row.source)
                    const href = hrefForRow(row)
                    const body = (
                      <MotionDiv
                        layout
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: Duration.fast, ease: Ease.expo }}
                        className="flex items-start gap-3 border-l border-rule py-2 pl-3 transition-colors hover:bg-[var(--surface-2)]/50"
                      >
                        <Icon className="mt-0.5 size-3.5 shrink-0 text-ink-faint" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-body-tight text-sm text-ink-strong">{row.title}</p>
                          {row.description ? (
                            <p className="truncate font-body text-xs text-ink-muted">{row.description}</p>
                          ) : null}
                          <p className="mt-0.5 font-label text-ink-faint">
                            {labelForEventType(row.type)} ·{" "}
                            {formatDistanceToNow(new Date(row.timestamp), { addSuffix: true })}
                          </p>
                        </div>
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
    </div>
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

export function QuickActions() {
  const router = useRouter()

  async function create(url: string, body: unknown, href: string, label: string) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("request failed")
      toast.success(`${label} created`)
      router.push(href)
    } catch {
      toast.error(`Could not create ${label.toLowerCase()}`)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-label text-ink-faint">Quick actions</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => create("/api/notes", { title: "New note", content: "[]", scope: "global" }, "/notepad", "Note")}
      >
        <Plus className="size-3.5" /> New note
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => create("/api/boards", { title: "New board", scope: "brainstorm" }, "/brainstorm-sketch", "Board")}
      >
        <Plus className="size-3.5" /> New board
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => create("/api/idea-maps", { title: "New idea map" }, "/ideas", "Idea map")}
      >
        <Plus className="size-3.5" /> New idea map
      </Button>
      <Button size="sm" variant="outline" onClick={() => commandMenuStore.toggle()}>
        <Command className="size-3.5" /> Command palette
      </Button>
    </div>
  )
}
