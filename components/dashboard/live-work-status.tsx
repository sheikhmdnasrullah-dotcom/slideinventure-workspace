"use client";

import { useWorkTimer, formatTime } from "@/lib/time-tracker/timer-store";
import { Pause, Play, Square, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { dashboardSummaryQuery } from "@/lib/dashboard/queries";

/**
 * Timer state in the app header, so it stays visible in every section.
 *
 * Reads the same `timerStore` as the dashboard stopwatch, so this is a second
 * view of one source rather than a second timer. Quiet by default: a dot, the
 * elapsed count, and the controls — no accent fill, no pulse.
 */
export function LiveWorkStatus() {
  const { isRunning, isIdle, elapsed, state, start, pause, resume, stop } = useWorkTimer();
  const queryClient = useQueryClient();

  const handleStop = async () => {
    const session = stop();
    if (!session) {
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
    }
  };

  if (isIdle) {
    return (
      <button
        type="button"
        onClick={() => start()}
        className="hidden items-center gap-1.5 rounded-md border border-rule px-2 py-1 font-body text-xs text-ink-muted transition-colors hover:border-rule-strong hover:text-ink-strong sm:flex"
        title="Start work timer"
      >
        <Timer className="size-3.5 text-ink-faint" />
        Track time
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-rule px-2 py-1">
      <span
        className={cn(
          "size-1.5 rounded-full",
          isRunning ? "bg-[var(--status-live)]" : "bg-[var(--status-warn)]"
        )}
        aria-hidden
      />

      <span className="font-mono text-xs font-medium tabular-nums text-ink-strong">
        {formatTime(elapsed)}
      </span>

      {state.project ? (
        <span className="hidden max-w-[120px] truncate font-body text-xs text-ink-muted sm:inline">
          {state.project}
        </span>
      ) : null}

      <span className="ml-0.5 flex items-center gap-0.5 border-l border-rule pl-1.5">
        <button
          type="button"
          onClick={isRunning ? pause : resume}
          className="rounded p-0.5 text-ink-faint hover:text-ink-strong"
          aria-label={isRunning ? "Pause timer" : "Resume timer"}
        >
          {isRunning ? <Pause className="size-3" /> : <Play className="size-3" />}
        </button>
        <button
          type="button"
          onClick={handleStop}
          className="rounded p-0.5 text-ink-faint hover:text-ink-strong"
          aria-label="Stop timer and save session"
        >
          <Square className="size-3" />
        </button>
      </span>
    </div>
  );
}

