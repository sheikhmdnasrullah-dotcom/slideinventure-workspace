"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { SiteHeader } from "@/components/dashboard/site-header";
import { OutreachChart } from "@/components/dashboard/outreach-chart";
import { ActivityTable } from "@/components/dashboard/activity-table";
import { ExecutionPanel } from "@/components/dashboard/execution-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Section, Surface, Metric, MetricRow, MetricCell, StatusBadge, Timeline, type TimelineItem } from "@/components/system";
import type { DashboardResponse, KpiCard, ActivityRow, ActivityStatus } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

/**
 * Command Center — the home page. Not a KPI wall. Reframes the four existing
 * metrics into the six questions the brief demanded the console answer:
 * what happened / what do we know / what changed / what did AI discover /
 * what needs attention / what next.
 *
 * Layout (top to bottom):
 *   1. PageHeader + sync button
 *   2. "What changed" rail — chronological evidence from activity
 *   3. "Needs attention" strip — proposed items, failed runs, conflicts
 *   5. "Live agents" micro-panel — running task_runs with progress
 *   6. Outreach velocity sparkline (the only graph)
 *   7. ActivityTable — the dense tail (existing component, reused)
 */
export function DashboardContent() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async (isSync: boolean) => {
    if (isSync) setSyncing(true);
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const json: DashboardResponse = await res.json();
      setData(json);
      if (isSync) toast.success("Dashboard synced");
    } catch {
      if (isSync) toast.error("Sync failed");
    } finally {
      if (isSync) setSyncing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const interval = setInterval(() => load(false), 10000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <>
      <SiteHeader title="Command Center" onSync={() => load(true)} syncing={syncing} />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {!data ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* 1. What changed — chronological evidence from the unified activity feed */}
            <Section tone="base">
              <PageHeader
                eyebrow="What changed"
                title="Recent activity"
                meta={new Date(data.syncedAt).toLocaleTimeString()}
              />
              <Surface variant="inset">
                <Timeline items={buildWhatChanged(data)} />
              </Surface>
            </Section>

            {/* 2. Needs attention — proposed items, failed runs, conflicts */}
            <Section tone="inset">
              <PageHeader
                eyebrow="Needs attention"
                title="Items requiring review"
                meta={buildNeedsAttentionCount(data)}
              />
              <Surface variant="flat">
                <div className="flex flex-wrap gap-2">
                  {buildNeedsAttention(data).map((item) => {
                    const tone = item.tone;
                    const toneClass = cn(
                      "gap-1",
                      tone === "danger" && "border-[var(--status-danger)]/30 bg-[color-mix(in_oklch,var(--status-danger)_10%,transparent)] text-[var(--status-danger)]",
                      tone === "flame" && "border-[var(--accent-ring)] bg-[var(--accent-wash)] text-[var(--text-accent)]",
                      tone === "live" && "border-[var(--status-live)]/30 bg-[color-mix(in_oklch,var(--status-live)_10%,transparent)] text-[var(--status-live)]"
                    );
                    return (
                      <Badge
                        key={item.label}
                        variant="outline"
                        className={toneClass}
                      >
                        {item.icon && (item.icon as React.ComponentType<{ className?: string }>)}
                        {item.label}
                      </Badge>
                    );
                  })}
                </div>
              </Surface>
            </Section>

            {/* 3. Live agents — running task_runs with progress */}
            <Section tone="base">
              <PageHeader
                eyebrow="Live agents"
                title="Running executions"
              />
              <Surface variant="inset">
                {buildLiveAgents(data).length === 0 ? (
                  <p className="font-body text-sm text-ink-muted py-4">
                    No agents running. Start a task from the execution panel below,
                    or run `npm run agent ...` from the terminal.
                  </p>
                ) : (
                  <Timeline items={buildLiveAgents(data)} />
                )}
              </Surface>
            </Section>

            {/* 4. Outreach velocity — the only graph */}
            <Section tone="anchor" seam bleed>
              <PageHeader
                eyebrow="Outreach"
                title="Velocity (7 days)"
              />
              <Surface variant="raised">
                <OutreachChart data={data.chart} />
              </Surface>
            </Section>

            {/* 5. Activity table — the dense tail */}
            <Section tone="base">
              <PageHeader
                eyebrow="Full log"
                title="All activity"
                meta={`${data.activity.length} events`}
              />
              <Surface variant="raised">
                <ActivityTable data={data.activity} />
              </Surface>
            </Section>
          </>
        )}
      </div>
    </>
  );
}

/* ─── Data shaping helpers ──────────────────────────────────────────────── */

function buildWhatChanged(data: DashboardResponse): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const act of data.activity.slice(0, 8)) {
    const tone = mapStatusToTone(act.status);
    items.push({
      id: act.id,
      title: act.item,
      description: act.source,
      tone,
      time: act.updatedAt,
    });
  }
  return items;
}

function buildNeedsAttentionCount(data: DashboardResponse): string {
  // knowledge-items KPI trend label may say "X proposed" or "X active"
  const kpi = data.kpis.find((k) => k.id === "knowledge-items");
  const proposedMatch = kpi?.trend?.label.match(/(\d+)\s*proposed/);
  const proposedCount = proposedMatch ? parseInt(proposedMatch[1], 10) : 0;
  const failed = data.activity.filter((a) => a.status === "failed").length;
  const total = proposedCount + failed;
  return total > 0 ? `${total} item${total === 1 ? "" : "s"}` : "All clear";
}

function buildNeedsAttention(data: DashboardResponse) {
  const items = [];
  const proposedCount = data.activity.filter((a) => a.status === "proposed").length;
  if (proposedCount > 0) {
    items.push({
      label: `${proposedCount} proposed knowledge item${proposedCount === 1 ? "" : "s"}`,
      tone: "flame" as const,
      icon: null,
    });
  }
  const failedRuns = data.activity.filter((a) => a.status === "failed").length;
  if (failedRuns > 0) {
    items.push({
      label: `${failedRuns} failed task run${failedRuns === 1 ? "" : "s"}`,
      tone: "danger" as const,
      icon: null,
    });
  }
  // Conflicts would be detected by the knowledge system — not present yet
  if (items.length === 0) {
    items.push({
      label: "Nothing pending",
      tone: "live" as const,
      icon: null,
    });
  }
  return items;
}

function buildLiveAgents(data: DashboardResponse): TimelineItem[] {
  const running = data.activity
    .filter((a) => a.status === "running")
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      title: a.item,
      description: `Started ${new Date(a.updatedAt).toLocaleTimeString()}`,
      tone: "live" as const,
      time: a.updatedAt,
    }));
  return running;
}

function mapStatusToTone(status: ActivityStatus): TimelineItem["tone"] {
  switch (status) {
    case "running":
      return "live";
    case "completed":
    case "active":
      return "live";
    case "failed":
      return "danger";
    case "proposed":
      return "flame";
    case "ai_inferred":
      return "info";
    default:
      return "neutral";
  }
}

/* ─── Skeleton (kept for perceived performance) ────────────────────────── */

function DashboardSkeleton() {
  return (
    <>
      <Section tone="base">
        <PageHeader eyebrow="What changed" title="Recent activity" />
        <Surface variant="inset">
          <div className="flex flex-col divide-y divide-rule">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        </Surface>
      </Section>
      <Section tone="inset">
        <PageHeader eyebrow="Needs attention" title="Items requiring review" />
        <Surface variant="flat">
          <Skeleton className="h-10" />
        </Surface>
      </Section>
      <Section tone="base">
        <PageHeader eyebrow="Live agents" title="Running executions" />
        <Surface variant="inset">
          <Skeleton className="h-10" />
        </Surface>
      </Section>
      <Section tone="anchor" seam bleed>
        <PageHeader eyebrow="Outreach" title="Velocity (7 days)" />
        <Surface variant="raised">
          <Skeleton className="h-72" />
        </Surface>
      </Section>
      <Section tone="base">
        <PageHeader eyebrow="Full log" title="All activity" />
        <Surface variant="raised">
          <Skeleton className="h-72" />
        </Surface>
      </Section>
    </>
  );
}