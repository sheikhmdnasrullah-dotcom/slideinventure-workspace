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

const TYPE_LABELS: Partial<Record<ActivityType, string>> = {
  research: "Research",
  prospects: "Prospects",
  sops: "SOP",
  decisions: "Decision",
  system: "System",
  script: "Script",
  cold_email: "Cold Email",
  automation: "Automation",
  documents: "Documents",
  notes: "Notes",
  terminal: "Terminal",
  links: "Links",
  chat: "Chat",
  ai_venture: "Concepts",
  todoist: "Todoist",
  knowledge: "Knowledge",
  leads: "Leads",
  vault: "Vault",
  integrations: "Integrations",
  agents: "Agents",
};

const STATUS_STYLES: Record<ActivityStatus, string> = {
  ai_inferred: "border-transparent bg-status-neutral-bg text-status-neutral",
  proposed: "border-transparent bg-flame-wash text-flame",
  active: "border-transparent bg-flame-wash text-flame",
  completed: "border-transparent bg-status-live-bg text-status-live",
  failed: "border-transparent bg-status-danger-bg text-status-danger",
  running: "border-transparent bg-flame-wash text-flame",
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
                    {TYPE_LABELS[row.type] ?? String(row.type).replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_STYLES[row.status] ?? "border-border bg-muted text-muted-foreground"}>
                    {STATUS_LABELS[row.status] ?? row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.source}</TableCell>
                <TableCell className="text-right font-code text-xs tabular-nums text-foreground/60">
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
        "inline-flex items-center gap-1 font-label text-ink-muted transition-colors hover:text-ink-strong",
        align === "right" && "flex-row-reverse"
      )}
    >
      {label}
      <ArrowUpDown className={cn("size-3", active && dir === "asc" && "rotate-180", "transition-transform")} />
    </button>
  );
}
