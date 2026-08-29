"use client";

import type { WorkTimeSummary } from "@/lib/time-tracker/types";
import { formatDurationHuman } from "@/lib/time-tracker/timer-store";
import { Panel, Stat } from "@/components/dashboard/panel";

/**
 * Work time. Manual stopwatch totals only — the authoritative record.
 *
 * The estimated-active figure the old card showed alongside these was inferred,
 * so it is gone: mixing a measured number with an inferred one in the same row
 * makes both untrustworthy.
 */
export function WorkTimePanel({ workTime }: { workTime?: WorkTimeSummary }) {
  const today = workTime?.today;
  const week = workTime?.thisWeek;
  const month = workTime?.thisMonth;
  const last = today?.lastSession;

  return (
    <Panel title="Work time" meta="Manual sessions">
      <div className="grid grid-cols-3 gap-4">
        <Stat
          label="Today"
          value={formatDurationHuman(today?.focusTimeSeconds ?? 0)}
          hint={`${today?.sessionsCount ?? 0} ${today?.sessionsCount === 1 ? "session" : "sessions"}`}
        />
        <Stat
          label="This week"
          value={formatDurationHuman(week?.focusTimeSeconds ?? 0)}
          hint={`${week?.sessionsCount ?? 0} ${week?.sessionsCount === 1 ? "session" : "sessions"}`}
        />
        <Stat
          label="This month"
          value={formatDurationHuman(month?.focusTimeSeconds ?? 0)}
          hint={`${month?.sessionsCount ?? 0} ${month?.sessionsCount === 1 ? "session" : "sessions"}`}
        />
      </div>

      <p className="mt-auto border-t border-rule pt-3 font-body text-xs text-ink-muted">
        {last ? (
          <>
            Last session {last.formattedRange}
            <span className="text-ink-faint"> · {last.project}</span>
          </>
        ) : (
          <span className="text-ink-faint">No sessions recorded today.</span>
        )}
      </p>
    </Panel>
  );
}
