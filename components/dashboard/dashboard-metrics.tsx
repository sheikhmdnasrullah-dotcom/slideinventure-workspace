"use client"

import * as React from "react"
import { Card, Metric, Text, BarChart, Grid, Flex } from "@tremor/react"
import Link from "next/link"
import { useLiveRefresh } from "@/components/providers/event-stream"
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
    <div className="flex flex-col gap-4">
      <Grid numItemsSm={2} numItemsLg={4} className="gap-3">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href} className="block">
            <Card className="transition-colors hover:bg-muted/50">
              <Text>{tile.label}</Text>
              <Metric className="tabular-nums">{tile.value ?? ""}</Metric>
            </Card>
          </Link>
        ))}
        {tiles.length === 0 ? (
          <Card>
            <Text>No metrics yet</Text>
            <Metric></Metric>
          </Card>
        ) : null}
      </Grid>

      <Card>
        <Flex alignItems="start">
          <div>
            <Text>Activity volume</Text>
            <div className="text-xs text-muted-foreground">Per day, last 14 days</div>
          </div>
        </Flex>
        {totalVolume === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activity recorded in the last 14 days.
          </p>
        ) : (
          <BarChart
            className="mt-4 h-44"
            data={volume}
            index="date"
            categories={["count"]}
            colors={["blue"]}
            showLegend={false}
            showGridLines={false}
            yAxisWidth={28}
            valueFormatter={(n) => String(n)}
          />
        )}
      </Card>
    </div>
  )
}
