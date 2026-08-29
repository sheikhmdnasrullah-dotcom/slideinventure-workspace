import { SiteHeader } from "@/components/dashboard/site-header";
import { DashboardMetrics } from "@/components/dashboard/dashboard-metrics";
import { LiveActivity } from "@/components/dashboard/live-activity";
import { CommandCenterHeader } from "@/components/dashboard/command-center-header";
import { WorkStopwatch } from "@/components/dashboard/work-stopwatch";
import { WorkTimeStats } from "@/components/dashboard/work-time-stats";
import { WorkSessionsHistory } from "@/components/dashboard/work-sessions-history";
import { TodayAtAGlance } from "@/components/dashboard/today-at-a-glance";
import { WhatChanged } from "@/components/dashboard/what-changed";
import { ContinueWorking } from "@/components/dashboard/continue-working";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import { NextBestAction } from "@/components/dashboard/next-best-action";
import { Section, SectionRule, Surface } from "@/components/system";
import { DataTable, type ActivityItem } from "@/components/dashboard/v3/data-table";
import type { DashboardResponse, ActivityRow, ActivityStatus } from "@/lib/dashboard/types";
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { Suspense, cache } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Deduplicated per-request loader.
 * Cached so multiple suspending components share the same upstream fetch.
 */
const getDashboardData = cache(async (): Promise<DashboardResponse | null> => {
  const cookie = (await headers()).get("cookie") ?? "";
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/dashboard`,
    { cache: "no-store", headers: cookie ? { cookie } : undefined }
  ).catch(() => null);

  return res?.ok ? ((await res.json()) as DashboardResponse) : null;
});

const DataTableLazy = dynamic(
  () => import("@/components/dashboard/v3/data-table").then((m) => m.DataTable),
  { loading: () => <div className="h-64 animate-pulse rounded-lg border border-rule bg-[var(--surface-2)]/30" /> }
);

function toDataTableItem(row: ActivityRow): ActivityItem {
  const status = mapStatus(row.status);
  return {
    id: row.id,
    header: row.item,
    type: humanize(row.type),
    status,
    target: row.source,
    limit: new Date(row.updatedAt).toLocaleDateString(),
    reviewer: row.source,
    source: row.source,
    updatedAt: row.updatedAt,
  };
}

function mapStatus(status: ActivityStatus): ActivityItem["status"] {
  if (status === "completed" || status === "active") return "Done";
  if (status === "running") return "In Progress";
  if (status === "failed") return "Failed";
  if (status === "proposed") return "Not Started";
  return "Not Started";
}

function humanize(value: string): string {
  switch (value) {
    case "cold_email":
      return "Cold Email";
    case "documents":
      return "Document";
    case "notes":
      return "Note";
    case "terminal":
      return "Terminal";
    case "links":
      return "Link";
    case "chat":
      return "Chat";
    case "ai_venture":
      return "Concepts";
    case "todoist":
      return "Todoist";
    case "knowledge":
      return "Knowledge";
    case "leads":
      return "Lead";
    case "brainstorm":
      return "Brainstorm";
    case "ideas":
      return "Idea Map";
    case "research":
      return "Research";
    default:
      return value.charAt(0).toUpperCase() + value.slice(1);
  }
}

export function DashboardHome() {
  return (
    <>
      <SiteHeader crumbs={[{ label: "Command Center" }]} />

      <div className="flex flex-1 flex-col gap-7 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
        {/* Tier 1: Command Center Header (Live Date/Time, Contextual Message, Quick Actions) */}
        <Suspense fallback={<HeaderSkeleton />}>
          <HeaderSection />
        </Suspense>

        {/* Tier 2: Today at a Glance (8 Live Workspace Metrics) */}
        <Suspense fallback={<TodaySkeleton />}>
          <TodaySection />
        </Suspense>

        {/* Tier 3: Work Time Tracking Engine (Manual Stopwatch + Focus Time Intelligence) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col">
            <WorkStopwatch />
          </div>
          <div className="lg:col-span-6 flex flex-col">
            <Suspense fallback={<TimeStatsSkeleton />}>
              <TimeStatsSection />
            </Suspense>
          </div>
        </div>

        {/* Tier 4: Workspace State & Resumption (What Changed? + Continue Where You Left Off) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">
          <Suspense fallback={<CardSkeleton />}>
            <WhatChangedSection />
          </Suspense>

          <Suspense fallback={<CardSkeleton />}>
            <ContinueSection />
          </Suspense>
        </div>

        {/* Tier 5: Strategic Attention & Next Move (Needs Attention + Next Best Action) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">
          <Suspense fallback={<CardSkeleton />}>
            <AttentionSection />
          </Suspense>

          <Suspense fallback={<CardSkeleton />}>
            <NextMoveSection />
          </Suspense>
        </div>

        {/* Tier 6: Live Activity Stream & Work Sessions Log */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">
          <LiveActivity />

          <Suspense fallback={<SessionsHistorySkeleton />}>
            <SessionsHistorySection />
          </Suspense>
        </div>

        {/* Tier 7: Global Workspace Pulse & Consolidated Data Table */}
        <Section tone="base" className="py-2">
          <Suspense fallback={<MetricsSkeleton />}>
            <MetricsSection />
          </Suspense>
        </Section>

        <Suspense fallback={<ActivityTableSkeleton />}>
          <ActivityTableSection />
        </Suspense>
      </div>
    </>
  );
}

async function HeaderSection() {
  const data = await getDashboardData();
  return (
    <CommandCenterHeader
      contextMessage={data?.contextMessage}
      syncedAt={data?.syncedAt}
    />
  );
}

async function TodaySection() {
  const data = await getDashboardData();
  return <TodayAtAGlance today={data?.todaySummary} />;
}

async function TimeStatsSection() {
  const data = await getDashboardData();
  return <WorkTimeStats workTime={data?.workTime} />;
}

async function WhatChangedSection() {
  const data = await getDashboardData();
  return <WhatChanged whatChanged={data?.whatChanged} />;
}

async function ContinueSection() {
  const data = await getDashboardData();
  return <ContinueWorking items={data?.continueItems} />;
}

async function AttentionSection() {
  const data = await getDashboardData();
  return <NeedsAttention items={data?.needsAttention} />;
}

async function NextMoveSection() {
  const data = await getDashboardData();
  return <NextBestAction actions={data?.nextBestActions} />;
}

async function SessionsHistorySection() {
  const data = await getDashboardData();
  return <WorkSessionsHistory sessions={data?.workTime?.recentSessions} />;
}

async function MetricsSection() {
  const data = await getDashboardData();
  return <DashboardMetrics initial={data} />;
}

async function ActivityTableSection() {
  const data = await getDashboardData();
  const tableItems: ActivityItem[] = (data?.activity ?? []).map(toDataTableItem);
  return (
    <div>
      <SectionRule
        label="Consolidated workspace ledger"
        coordinate={`${tableItems.length} record${tableItems.length === 1 ? "" : "s"}`}
      />
      <Surface variant="raised" className="px-0 py-0 overflow-hidden border border-rule rounded-xl">
        <DataTableLazy data={tableItems} />
      </Surface>
    </div>
  );
}

/* Skeleton Loaders */

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 border-b border-rule pb-6">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-rule p-5">
      <Skeleton className="h-5 w-36" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function TimeStatsSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-rule p-5 h-full min-h-[220px]">
      <Skeleton className="h-5 w-44" />
      <div className="grid grid-cols-3 gap-3 my-auto">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-rule p-5 h-full min-h-[200px]">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}

function SessionsHistorySkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-rule p-5 h-full min-h-[300px]">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div className="flex flex-col">
      <SectionRule label="Workspace pulse" />
      <div className="grid grid-cols-2 gap-px sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 p-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityTableSkeleton() {
  return (
    <div>
      <SectionRule label="Consolidated workspace ledger" />
      <Surface variant="raised" className="px-0 py-0">
        <Skeleton className="h-64 w-full rounded-lg" />
      </Surface>
    </div>
  );
}
