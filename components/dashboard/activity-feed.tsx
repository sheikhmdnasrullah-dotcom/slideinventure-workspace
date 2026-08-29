"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { SiteHeader } from "@/components/dashboard/site-header"
import { PageHeader, Surface, Timeline, FilterBar, EmptyState, type TimelineItem } from "@/components/system"
import { Button } from "@/components/ui/button"
import { useLiveEvents } from "@/components/providers/event-stream"
import type { Activity, ActivityCategory, ActivityAction } from "@/lib/activities/types"
import type { DomainEvent } from "@/lib/events/types"

const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  leads: "Leads",
  documents: "Documents",
  knowledge: "Knowledge",
  chat: "Chat",
  ai_venture: "Concepts",
  todoist: "Todoist",
  notes: "Notes",
  terminal: "Terminal",
  links: "Links",
  vault: "Vault",
  integrations: "Integrations",
  agents: "Agents",
  concepts: "Concepts",
  brainstorm: "Brainstorm",
  system: "System",
}

const CATEGORY_ROUTE: Partial<Record<ActivityCategory, string>> = {
  leads: "/leads",
  documents: "/documents",
  knowledge: "/knowledge",
  chat: "/chat",
  ai_venture: "/concepts",
  todoist: "/todoist",
  notes: "/notepad",
  terminal: "/terminal",
  links: "/useful-links",
  agents: "/agents",
  concepts: "/concepts",
  brainstorm: "/brainstorm-sketch",
}

const ACTION_TONE: Record<string, TimelineItem["tone"]> = {
  created: "live",
  uploaded: "live",
  imported: "live",
  connected: "live",
  completed: "live",
  executed: "info",
  messaged: "info",
  edited: "info",
  renamed: "info",
  moved: "info",
  updated: "neutral",
  deleted: "danger",
  exported: "neutral",
}

// Reverse of the source->category mapping in lib/events/types so a live domain
// event can be folded into the activity list without a refetch.
const CATEGORY_BY_SOURCE: Partial<Record<string, ActivityCategory>> = {
  leads: "leads",
  documents: "documents",
  knowledge: "knowledge",
  chat: "chat",
  "ai-venture": "ai_venture",
  todoist: "todoist",
  notes: "notes",
  terminal: "terminal",
  links: "links",
  vault: "vault",
  integrations: "integrations",
  agents: "agents",
  ideas: "brainstorm",
  brainstorm: "brainstorm",
  "research-lab": "ai_venture",
}

function dedupeKey(a: Activity): string {
  return `${a.entityId ?? a.id}__${a.category}.${a.action}__${a.timestamp}`
}

function eventToActivity(e: DomainEvent): Activity {
  const [subject, action] = e.type.split(".")
  return {
    id: e.id,
    category: CATEGORY_BY_SOURCE[e.source] ?? "notes",
    action: (action as ActivityAction) ?? "created",
    title: e.title,
    description: e.description,
    entityId: e.entityId,
    entityType: e.entityType,
    timestamp: e.timestamp,
  }
}


function toTimelineItem(a: Activity): TimelineItem {
  return {
    id: a.id,
    title: a.title,
    description: a.description || undefined,
    tone: ACTION_TONE[a.action] ?? "neutral",
    time: a.timestamp,
    href: CATEGORY_ROUTE[a.category],
  }
}

export function ActivityFeed() {
  const [activities, setActivities] = React.useState<Activity[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [category, setCategory] = React.useState<string | null>(null)
  const [cursor, setCursor] = React.useState<string | null>(null)
  const [hasMore, setHasMore] = React.useState(false)

  // Fold live domain events into the list in place. Dedupe by
  // entityId + category.action + timestamp so a live event and its later
  // refetch do not appear twice.
  const { events } = useLiveEvents()
  React.useEffect(() => {
    if (events.length === 0) return
    setActivities((prev) => {
      const merged = [...events.map(eventToActivity), ...prev]
      const seen = new Set<string>()
      const out: Activity[] = []
      for (const a of merged) {
        const key = dedupeKey(a)
        if (!seen.has(key)) {
          seen.add(key)
          out.push(a)
        }
      }
      return out
    })
  }, [events])

  const load = React.useCallback(async (opts?: { append?: boolean; after?: string | null }) => {
    const params = new URLSearchParams({ limit: "40" })
    if (category) params.set("category", category)
    if (opts?.after) params.set("cursor", opts.after)
    try {
      const res = await fetch(`/api/activities?${params.toString()}`, { cache: "no-store" })
      const data = await res.json()
      const items: Activity[] = Array.isArray(data.activities) ? data.activities : []
      setActivities((prev) => (opts?.append ? [...prev, ...items] : items))
      setCursor(data.nextCursor ?? null)
      setHasMore(!!data.nextCursor)
    } catch {
      if (!opts?.append) setActivities([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [category])

  React.useEffect(() => {
    setLoading(true)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  const handleLoadMore = () => {
    if (!cursor) return
    setLoadingMore(true)
    load({ append: true, after: cursor })
  }

  // ai_venture/concepts share a label (the section was renamed): collapse
  // to one chip, filtering by whichever tag comes first.
  const categoryOptions = React.useMemo(() => {
    const seenLabels = new Set<string>()
    const opts: { value: string; label: string }[] = []
    for (const c of Object.keys(CATEGORY_LABEL) as ActivityCategory[]) {
      const label = CATEGORY_LABEL[c]
      if (seenLabels.has(label)) continue
      seenLabels.add(label)
      opts.push({ value: c, label })
    }
    return opts
  }, [])

  const items = React.useMemo(() => activities.map(toTimelineItem), [activities])

  return (
    <>
      <SiteHeader crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Activity" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <PageHeader
          eyebrow="System"
          title="Activity"
          meta={loading ? undefined : `${activities.length}${hasMore ? "+" : ""} events`}
        />
        <FilterBar>
          <FilterBar.Chips
            ariaLabel="Filter by category. Click the active one again to clear"
            value={category}
            onChange={setCategory}
            options={categoryOptions}
          />
        </FilterBar>
        <Surface variant="inset">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-faint">
              <Loader2 className="size-4 animate-spin" /> Loading
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              eyebrow="No events yet"
              title="No activity yet"
              description="Work done in any section appears here as it happens."
            />
          ) : (
            <>
              <Timeline items={items} />
              {hasMore && (
                <div className="flex justify-center pt-3">
                  <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </Surface>
      </div>
    </>
  )
}
