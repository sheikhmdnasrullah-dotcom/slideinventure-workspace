"use client";

import * as React from "react";
import { useWorkTimer, formatTime } from "@/lib/time-tracker/timer-store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { dashboardSummaryQuery } from "@/lib/dashboard/queries";
import { Panel } from "@/components/dashboard/panel";
import { cn } from "@/lib/utils";

/**
 * Manual stopwatch. The authoritative source for work time.
 *
 * State lives in `timerStore` (localStorage + BroadcastChannel), so the timer
 * survives navigation, refresh and a second tab. This component only renders it
 * and posts the finished session.
 *
 * Context and note are plain inputs rather than preset chips: presets were a
 * guess at what the work would be called.
 */
export function WorkStopwatch() {
  const { state, elapsed, isRunning, isPaused, isIdle, start, pause, resume, stop, reset, updateContext } =
    useWorkTimer();

  const [isSaving, setIsSaving] = React.useState(false);
  const queryClient = useQueryClient();

  // Context and note read straight from the timer store rather than local state,
  // so a second tab editing them stays in sync without a syncing effect.
  const project = state.project ?? "";
  const note = state.note ?? "";

  const handleStop = async () => {
    setIsSaving(true);
    const session = stop();
    if (!session) {
      setIsSaving(false);
      toast.info("Discarded — sessions under 3 seconds are not saved");
      return;
    }

    try {
      const res = await fetch("/api/time-tracker/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      });
      if (!res.ok) throw new Error("save failed");
      toast.success(`Saved ${Math.round(session.duration / 60)}m`);
      void queryClient.invalidateQueries({ queryKey: dashboardSummaryQuery.queryKey });
      void queryClient.invalidateQueries({ queryKey: ["time-tracker", "sessions"] });
    } catch {
      toast.error("Could not save session");
    } finally {
      setIsSaving(false);
    }
  };

  const statusLabel = isRunning ? "Running" : isPaused ? "Paused" : "Not tracking";

  return (
    <Panel title="Stopwatch" meta={statusLabel} className="scroll-mt-6" bodyClassName="gap-4">
      <div id="stopwatch-section" className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "size-1.5 rounded-full",
              isRunning
                ? "bg-[var(--status-live)]"
                : isPaused
                  ? "bg-[var(--status-warn)]"
                  : "bg-[var(--text-faint)]"
            )}
            aria-hidden
          />
          <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-ink-strong">
            {formatTime(elapsed)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isIdle ? (
            <Button size="sm" onClick={() => start(project || undefined, note)} className="text-xs">
              Start
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={isRunning ? pause : resume}
                className="text-xs font-normal"
              >
                {isRunning ? "Pause" : "Resume"}
              </Button>
              <Button size="sm" disabled={isSaving} onClick={handleStop} className="text-xs">
                {isSaving ? "Saving" : "Stop"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={reset}
                className="text-xs font-normal text-ink-faint"
                title="Discard without saving"
              >
                Discard
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          type="text"
          value={project}
          onChange={(e) => updateContext(e.target.value, note)}
          placeholder="What are you working on?"
          aria-label="Session context"
          className="rounded-md border border-rule bg-[var(--surface-2)] px-2.5 py-1.5 font-body text-xs text-ink-strong placeholder:text-ink-faint focus:border-rule-strong focus:outline-hidden"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => updateContext(project, e.target.value)}
          placeholder="Note (optional)"
          aria-label="Session note"
          className="rounded-md border border-rule bg-[var(--surface-2)] px-2.5 py-1.5 font-body text-xs text-ink-strong placeholder:text-ink-faint focus:border-rule-strong focus:outline-hidden"
        />
      </div>
    </Panel>
  );
}
