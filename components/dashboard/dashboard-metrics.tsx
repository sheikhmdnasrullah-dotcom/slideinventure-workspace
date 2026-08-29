"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useLiveRefresh } from "@/components/providers/event-stream"
import { Panel, PanelEmpty, Stat } from "@/components/dashboard/panel"
import { dashboardSummaryQuery } from "@/lib/dashboard/queries"
import type { DashboardResponse, DashboardCounts } from "@/lib/dashboard/types"

type Tile = {
  label: string
  value: number | null
  href: string
}

function tilesFromCounts(counts: DashboardCounts | undefined): Tile[] {
  if (!counts) return []
  return [
    { label: "Notes", value: counts.notes, href: "/notepad" },
    { label: "Documents", value: counts.documents, href: "/documents" },
    { label: "Knowledge", value: counts.knowledge, href: "/knowledge" },
    { label: "Leads", value: counts.leads, href: "/leads" },
    { label: "Boards", value: counts.boards, href: "/brainstorm-sketch" },
    { label: "Agent runs", value: counts.agentRuns, href: "/agents" },
    { label: "Activities (7d)", value: counts.activities7d, href: "/activity" },
  ]
}

/** Tiny inline 14-day trend, not a chart card. Omitted entirely when there is
 * no volume to show, per house rule: no empty chart boxes, no invented data. */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const max = Math.max(...points, 1)
  const w = 72
  const h = 22
  const step = w / (points.length - 1)
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (p / max) * h).toFixed(1)}`)
    .join(" ")
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible text-[var(--text-accent)]" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DashboardMetrics({ initial }: { initial: DashboardResponse | null }) {
  const queryClient = useQueryClient()

  // The server render already paid for this request, so seed the cache with it
  // instead of re-fetching on mount. `initialData` is skipped when the server
  // could not prefill (e.g. no session yet), in which case this fetches normally.
  const { data } = useQuery({
    ...dashboardSummaryQuery,
    initialData: initial ?? undefined,
  })

  // Stay live: any write in a tracked section invalidates the cached summary, so
  // the push layer keeps driving freshness rather than polling.
  useLiveRefresh(
    React.useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: dashboardSummaryQuery.queryKey })
    }, [queryClient]),
    {
      types: ["note.", "file.", "board.", "knowledge.", "lead.", "agent.", "idea.", "chat.", "terminal."],
    }
  )

  const tiles = tilesFromCounts(data?.counts)
  const volume = data?.activityVolume ?? []
  const totalVolume = volume.reduce((s, p) => s + p.count, 0)

  return (
    <Panel
      title="Workspace"
      action={
        totalVolume > 0 ? (
          <span className="flex items-center gap-2">
            <span className="font-label text-xs text-ink-faint">14d</span>
            <Sparkline points={volume.map((p) => p.count)} />
          </span>
        ) : undefined
      }
    >
      {tiles.length === 0 ? (
        <PanelEmpty hint="Counts appear as you create notes, documents and boards.">
          Nothing recorded yet.
        </PanelEmpty>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 lg:grid-cols-7">
          {tiles.map((tile) => (
            <Stat key={tile.label} label={tile.label} value={tile.value ?? 0} href={tile.href} />
          ))}
        </div>
      )}
    </Panel>
  )
}
