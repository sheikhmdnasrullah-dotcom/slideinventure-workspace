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
        className="hidden h-8 items-center gap-1.5 rounded-pill border border-rule-strong px-3.5 text-[13px] font-medium whitespace-nowrap text-ink-muted transition-colors hover:text-ink-strong hover:shadow-raised sm:flex"
        title="Start work timer"
      >
        <Timer className="size-4 text-ink-faint" />
        Track time
      </button>
    );
  }

  return (
    <div className="flex h-8 items-center gap-2 rounded-pill border border-rule-strong bg-surface px-3.5">
      <span
        className={cn(
          "size-1.5 rounded-full",
          isRunning ? "bg-[var(--status-live)]" : "bg-[var(--status-warn)]"
        )}
        aria-hidden
      />

      <span className="font-value text-xs text-ink-strong">
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
          className="rounded-full p-1 text-ink-faint transition-colors hover:bg-hover-tint hover:text-ink-strong"
          aria-label={isRunning ? "Pause timer" : "Resume timer"}
        >
          {isRunning ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={handleStop}
          className="rounded-full p-1 text-ink-faint transition-colors hover:bg-hover-tint hover:text-ink-strong"
          aria-label="Stop timer and save session"
        >
          <Square className="size-3.5" />
        </button>
      </span>
    </div>
  );
}

