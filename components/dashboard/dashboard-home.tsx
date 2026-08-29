import { SiteHeader } from "@/components/dashboard/site-header";
import { DashboardMetrics } from "@/components/dashboard/dashboard-metrics";
import { LiveActivity } from "@/components/dashboard/live-activity";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { WorkStopwatch } from "@/components/dashboard/work-stopwatch";
import { WorkTimePanel } from "@/components/dashboard/work-time-panel";
import { WorkSessionsHistory } from "@/components/dashboard/work-sessions-history";
import { TodayPanel } from "@/components/dashboard/today-panel";
import { ContinuePanel } from "@/components/dashboard/continue-panel";
import { AttentionPanel, NextUpPanel } from "@/components/dashboard/attention-panel";
import type { DashboardResponse } from "@/lib/dashboard/types";
import { headers } from "next/headers";
import { Suspense, cache } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Dashboard.
 *
 * Seven panels, one container style, one column width. Reads top to bottom as:
 * what today looks like → the timer that produces those numbers → what to pick
 * up and what is broken → the raw log → workspace totals.
 *
 * Every value comes from /api/dashboard. Nothing is inferred, scored or phrased
 * as advice, and no panel renders a placeholder number: a metric with no data
 * shows 0 or an empty state that says what would fill it.
 */

/** Deduplicated per-request loader shared by every suspending section. */
const getDashboardData = cache(async (): Promise<DashboardResponse | null> => {
  const cookie = (await headers()).get("cookie") ?? "";
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/dashboard`,
    { cache: "no-store", headers: cookie ? { cookie } : undefined }
  ).catch(() => null);

  return res?.ok ? ((await res.json()) as DashboardResponse) : null;
});

export function DashboardHome() {
  return (
    <>
      <SiteHeader crumbs={[{ label: "Dashboard" }]} />

      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
        <DashboardHeader />

        <Suspense fallback={<PanelSkeleton rows={2} />}>
          <TodaySection />
        </Suspense>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <WorkStopwatch />
          <Suspense fallback={<PanelSkeleton rows={2} />}>
            <TimeStatsSection />
          </Suspense>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Suspense fallback={<PanelSkeleton rows={3} />}>
            <ContinueSection />
          </Suspense>
          <Suspense fallback={<PanelSkeleton rows={3} />}>
            <NextUpSection />
          </Suspense>
          <Suspense fallback={<PanelSkeleton rows={3} />}>
            <AttentionSection />
          </Suspense>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <LiveActivity />
          <Suspense fallback={<PanelSkeleton rows={4} />}>
            <SessionsHistorySection />
          </Suspense>
        </div>

        <Suspense fallback={<PanelSkeleton rows={2} />}>
          <MetricsSection />
        </Suspense>
      </div>
    </>
  );
}

async function TodaySection() {
  const data = await getDashboardData();
  return <TodayPanel today={data?.todaySummary} whatChanged={data?.whatChanged} />;
}

async function TimeStatsSection() {
  const data = await getDashboardData();
  return <WorkTimePanel workTime={data?.workTime} />;
}

async function ContinueSection() {
  const data = await getDashboardData();
  return <ContinuePanel items={data?.continueItems} />;
}

async function NextUpSection() {
  const data = await getDashboardData();
  return <NextUpPanel actions={data?.nextBestActions} />;
}

async function AttentionSection() {
  const data = await getDashboardData();
  return <AttentionPanel items={data?.needsAttention} />;
}

async function SessionsHistorySection() {
  const data = await getDashboardData();
  return <WorkSessionsHistory sessions={data?.workTime?.recentSessions} />;
}

async function MetricsSection() {
  const data = await getDashboardData();
  return <DashboardMetrics initial={data} />;
}

/** One skeleton shape, matching Panel's border and header, for every section. */
function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col rounded-lg border border-rule bg-[var(--surface)]">
      <div className="border-b border-rule px-4 py-2.5">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    </div>
  );
}
