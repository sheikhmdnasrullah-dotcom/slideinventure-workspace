"use client";

import * as React from "react";
import { formatDurationHuman } from "@/lib/time-tracker/timer-store";
import type { WorkTimeSummary } from "@/lib/time-tracker/types";
import { Clock, Zap, Calendar, History, ShieldCheck, Activity } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface WorkTimeStatsProps {
  workTime?: WorkTimeSummary;
}

export function WorkTimeStats({ workTime }: WorkTimeStatsProps) {
  const today = workTime?.today;
  const thisWeek = workTime?.thisWeek;
  const thisMonth = workTime?.thisMonth;

  const todayFocusFormatted = formatDurationHuman(today?.focusTimeSeconds ?? 0);
  const weekFocusFormatted = formatDurationHuman(thisWeek?.focusTimeSeconds ?? 0);
  const monthFocusFormatted = formatDurationHuman(thisMonth?.focusTimeSeconds ?? 0);
  const estimatedActiveFormatted = formatDurationHuman(today?.estimatedActiveSeconds ?? 0);

  const lastSession = today?.lastSession;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-rule bg-[var(--surface)] p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-rule/60 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-[var(--text-accent)]" />
          <h3 className="font-display text-sm font-semibold text-ink-strong uppercase tracking-wider">
            Work Time Intelligence
          </h3>
        </div>

        <Tooltip>
          <TooltipTrigger className="flex cursor-help items-center gap-1 font-label text-[11px] text-ink-faint hover:text-ink-muted">
            <ShieldCheck className="size-3 text-emerald-600" />
            <span>Authoritative</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            Manual stopwatch tracking is the authoritative source of truth. Active time estimates capture workflow bursts across sections without counting idle time.
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Primary Metrics Grid */}
      <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {/* Today Focus */}
        <div className="flex flex-col gap-1 rounded-lg border border-rule/60 bg-[var(--surface-2)]/40 p-3">
          <span className="font-label text-[11px] font-medium text-ink-faint uppercase">
            Focused Today
          </span>
          <span className="font-mono text-2xl font-bold tracking-tight text-ink-strong">
            {todayFocusFormatted}
          </span>
          <span className="font-body text-xs text-ink-muted">
            {today?.sessionsCount ?? 0} {today?.sessionsCount === 1 ? "session" : "sessions"}
          </span>
        </div>

        {/* This Week */}
        <div className="flex flex-col gap-1 rounded-lg border border-rule/60 bg-[var(--surface-2)]/40 p-3">
          <span className="font-label text-[11px] font-medium text-ink-faint uppercase">
            This Week
          </span>
          <span className="font-mono text-2xl font-bold tracking-tight text-ink-strong">
            {weekFocusFormatted}
          </span>
          <span className="font-body text-xs text-ink-muted">
            {thisWeek?.sessionsCount ?? 0} {thisWeek?.sessionsCount === 1 ? "session" : "sessions"}
          </span>
        </div>

        {/* This Month */}
        <div className="flex flex-col gap-1 rounded-lg border border-rule/60 bg-[var(--surface-2)]/40 p-3 col-span-2 sm:col-span-1">
          <span className="font-label text-[11px] font-medium text-ink-faint uppercase">
            This Month
          </span>
          <span className="font-mono text-2xl font-bold tracking-tight text-ink-strong">
            {monthFocusFormatted}
          </span>
          <span className="font-body text-xs text-ink-muted">
            {thisMonth?.sessionsCount ?? 0} total sessions
          </span>
        </div>
      </div>

      {/* Bottom Row: Last Session & Active Estimate */}
      <div className="flex flex-col gap-2 border-t border-rule/60 pt-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-ink-muted">
          <History className="size-3.5 shrink-0 text-ink-faint" />
          <span className="font-label text-ink-faint">Last Session:</span>
          {lastSession ? (
            <span className="font-medium text-ink-strong">
              {lastSession.formattedRange} ({lastSession.project})
            </span>
          ) : (
            <span className="text-ink-faint">No previous sessions today</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-ink-faint">
          <Activity className="size-3.5 text-sky-500 shrink-0" />
          <span>Estimated Active Time:</span>
          <span className="font-mono font-medium text-ink-muted">{estimatedActiveFormatted}</span>
        </div>
      </div>
    </div>
  );
}
