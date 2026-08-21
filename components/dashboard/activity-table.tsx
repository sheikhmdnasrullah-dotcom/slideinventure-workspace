"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ActivityRow, ActivityStatus, ActivityType } from "@/lib/dashboard/types";

const TYPE_LABELS: Record<ActivityType, string> = {
  research: "Research",
  prospects: "Prospects",
  sops: "SOP",
  decisions: "Decision",
  system: "System",
  script: "Script",
  cold_email: "Cold Email",
  automation: "Automation",
};

const STATUS_STYLES: Record<ActivityStatus, string> = {
  ai_inferred: "border-border bg-muted text-muted-foreground",
  proposed: "border-brand/30 bg-brand-soft text-signal",
  active: "border-signal/30 bg-signal/10 text-signal",
  completed: "border-signal/30 bg-signal/10 text-signal",
  failed: "border-red-500/30 bg-red-500/10 text-red-500",
  running: "border-brand/30 bg-brand-soft text-signal",
};

const STATUS_LABELS: Record<ActivityStatus, string> = {
  ai_inferred: "AI inferred",
  proposed: "Proposed",
  active: "Active",
  completed: "Completed",
  failed: "Failed",
  running: "Running",
};

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

type SortKey = "item" | "updatedAt";

export function ActivityTable({ data }: { data: ActivityRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const rows = [...data];
    rows.sort((a, b) => {
      const cmp = a[sortKey].localeCompare(b[sortKey]);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [data, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <Card className="[--card-spacing:1.5rem]">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <p className="text-sm text-muted-foreground">Latest changes across the knowledge base</p>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>
                <SortButton label="Item" active={sortKey === "item"} dir={sortDir} onClick={() => toggleSort("item")} />
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">
                <SortButton
                  label="Updated"
                  active={sortKey === "updatedAt"}
                  dir={sortDir}
                  onClick={() => toggleSort("updatedAt")}
                  align="right"
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-foreground">{row.item}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-border bg-transparent text-muted-foreground">
                    {TYPE_LABELS[row.type]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_STYLES[row.status]}>
                    {STATUS_LABELS[row.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.source}</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-foreground/60">
                  {dateFormat.format(new Date(row.updatedAt))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground",
        align === "right" && "flex-row-reverse"
      )}
    >
      {label}
      <ArrowUpDown className={cn("size-3", active && dir === "asc" && "rotate-180", "transition-transform")} />
    </button>
  );
}
