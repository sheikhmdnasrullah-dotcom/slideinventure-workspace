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
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((kpi) => (
        <Card key={kpi.id} className="@container/card">
          <CardHeader>
            <CardDescription>{kpi.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {kpi.value}
          </CardTitle>
            <CardAction>
              <Badge
                variant="outline"
                className={
                  kpi.trend.direction === "up"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : kpi.trend.direction === "down"
                      ? "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : "border-border bg-muted text-muted-foreground"
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
