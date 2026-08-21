import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { KpiCard as KpiCardData } from "@/lib/dashboard/types";

const TREND_STYLES = {
  up: "border-signal/30 bg-brand-soft text-signal",
  down: "border-destructive/30 bg-destructive/10 text-destructive",
  flat: "border-border bg-muted text-muted-foreground",
} as const;

const TREND_ICONS = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

export function KpiCard({ data }: { data: KpiCardData }) {
  const TrendIcon = TREND_ICONS[data.trend.direction];

  return (
    <Card className="[--card-spacing:1.5rem]">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm text-muted-foreground">{data.label}</span>
          <Badge variant="outline" className={cn("gap-1", TREND_STYLES[data.trend.direction])}>
            <TrendIcon className="size-3" />
            {data.trend.label}
          </Badge>
        </div>
        <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">
          {data.value}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{data.context}</span>
          <span className="text-xs text-muted-foreground/70">{data.subline}</span>
        </div>
      </CardContent>
    </Card>
  );
}
