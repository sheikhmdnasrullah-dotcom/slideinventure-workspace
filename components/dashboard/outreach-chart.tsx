"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { ChartPoint } from "@/lib/dashboard/types";

const RANGES = [
  { value: 90, label: "3 months" },
  { value: 30, label: "30 days" },
  { value: 7, label: "7 days" },
] as const;

const chartConfig = {
  sent: { label: "Sent", color: "var(--chart-2)" },
  replies: { label: "Replies", color: "var(--brand)" },
} satisfies ChartConfig;

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function OutreachChart({ data }: { data: ChartPoint[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>(30);

  const visible = useMemo(() => data.slice(-range), [data, range]);

  return (
    <Card className="[--card-spacing:1.5rem]">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Outreach Activity</CardTitle>
          <p className="text-sm text-muted-foreground">Emails sent vs. replies received</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                range === r.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="wait">
          <motion.div
            key={range}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
              <AreaChart data={visible} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-sent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-sent)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillReplies" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-replies)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-replies)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value: string) => dateFormat.format(new Date(value))}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => dateFormat.format(new Date(String(value)))}
                      indicator="dot"
                    />
                  }
                />
                <Area
                  dataKey="sent"
                  type="monotone"
                  fill="url(#fillSent)"
                  stroke="var(--color-sent)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="replies"
                  type="monotone"
                  fill="url(#fillReplies)"
                  stroke="var(--color-replies)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
