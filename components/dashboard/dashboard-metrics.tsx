"use client"

import * as React from "react"
import Link from "next/link"
import { useLiveRefresh } from "@/components/providers/event-stream"
import { Metric, MetricRow, MetricCell, SectionRule } from "@/components/system"
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
  const [data, setData] = React.useState<DashboardResponse | null>(initial)

  const refetch = React.useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" })
      if (res.ok) setData((await res.json()) as DashboardResponse)
    } catch {
      /* keep last good data */
    }
  }, [])

  // Stay live: any write in a tracked section refreshes the counts and chart.
  useLiveRefresh(refetch, {
    types: ["note.", "file.", "board.", "knowledge.", "lead.", "agent.", "idea.", "chat.", "terminal."],
  })

  // Fallback for when the server could not prefill data (e.g. no session in the
  // initial render): pull real numbers on mount so the tiles are never blank.
  React.useEffect(() => {
    if (!data) refetch()
  }, [data, refetch])

  const tiles = tilesFromCounts(data?.counts)
  const volume = data?.activityVolume ?? []
  const totalVolume = volume.reduce((s, p) => s + p.count, 0)

  return (
    <div className="flex flex-col">
      <SectionRule
        label="Workspace pulse"
        coordinate={totalVolume > 0 ? <Sparkline points={volume.map((p) => p.count)} /> : undefined}
      />
      {tiles.length === 0 ? (
        <p className="font-body text-sm text-ink-muted">
          No workspace activity yet. Numbers appear here as you create notes, documents and boards.
        </p>
      ) : (
        <MetricRow>
          {tiles.map((tile) => (
            <MetricCell key={tile.label}>
              <Metric label={tile.label} value={tile.value ?? "—"} href={tile.href} />
            </MetricCell>
          ))}
        </MetricRow>
      )}
    </div>
  )
}
