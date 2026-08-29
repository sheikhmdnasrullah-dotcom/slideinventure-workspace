"use client";

import type { TodayMetrics, WhatChangedSummary } from "@/lib/dashboard/types";
import { formatDurationHuman } from "@/lib/time-tracker/timer-store";
import { Panel, Stat } from "@/components/dashboard/panel";

/**
 * Today. Eight counts for the current local day, each linking to the section
 * that produced it, plus the deltas since the previous day underneath.
 *
 * Zero is shown as zero — it is a true statement about today, not missing data.
 */
export function TodayPanel({
  today,
  whatChanged,
}: {
  today?: TodayMetrics;
  whatChanged?: WhatChangedSummary;
}) {
  const stats = [
    { label: "Focus", value: formatDurationHuman(today?.focusTimeSeconds ?? 0), href: "#stopwatch-section" },
    { label: "Sessions", value: today?.sessionsCount ?? 0, href: "#stopwatch-section" },
    { label: "Completed", value: today?.completedTasks ?? 0, href: "/todoist" },
    { label: "Created", value: today?.createdItems ?? 0, href: "/activity" },
    { label: "Research", value: today?.researchUpdates ?? 0, href: "/research-lab" },
    { label: "Agent runs", value: today?.agentRuns ?? 0, href: "/agents" },
    { label: "Leads", value: today?.newLeads ?? 0, href: "/leads" },
    { label: "Notes", value: today?.notesCount ?? 0, href: "/notepad" },
  ];

  const deltas = whatChanged?.items ?? [];

  return (
    <Panel title="Today" meta={today?.dateFormatted}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 lg:grid-cols-8">
        {stats.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} href={s.href} />
        ))}
      </div>

      {deltas.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule pt-3">
          <span className="font-label text-xs text-ink-faint">
            {whatChanged?.sinceLabel ?? "Since yesterday"}
          </span>
          {deltas.map((d) => (
            <span key={d.label} className="font-body text-xs text-ink-muted">
              <span className="font-mono tabular-nums text-ink-strong">+{d.count}</span>{" "}
              {d.label.replace(/^\d+\s*/, "")}
            </span>
          ))}
        </div>
      )}
    </Panel>
  );
}
