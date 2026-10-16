import { TrendingDown, TrendingUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import type { KpiCard as KpiCardData } from "@/lib/dashboard/types"

export function SectionCards({ kpis }: { kpis: KpiCardData[] }) {
  const cards = kpis.slice(0, 4)
  if (cards.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((kpi) => (
        <Card key={kpi.id} className="@container/card">
          <CardHeader>
            <CardDescription>{kpi.label}</CardDescription>
            <CardTitle className="font-value text-2xl @[250px]/card:text-3xl">
              {kpi.value}
          </CardTitle>
            <CardAction>
              <Badge
                variant="outline"
                className={
                  kpi.trend.direction === "up"
                    ? "border-transparent bg-status-live-bg text-status-live"
                    : kpi.trend.direction === "down"
                      ? "border-transparent bg-status-danger-bg text-status-danger"
                      : "border-transparent bg-status-neutral-bg text-status-neutral"
                }
              >
                {kpi.trend.direction === "up" ? (
                  <TrendingUp />
                ) : kpi.trend.direction === "down" ? (
                  <TrendingDown />
                ) : null}
                {kpi.trend.label}
            </Badge>
          </CardAction>
        </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {kpi.context}
           </div>
            <div className="text-muted-foreground">{kpi.subline}</div>
        </CardFooter>
      </Card>
      ))}
  </div>
  )
}
