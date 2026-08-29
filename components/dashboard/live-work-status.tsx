"use client";

import * as React from "react";
import { useWorkTimer, formatTime } from "@/lib/time-tracker/timer-store";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { dashboardSummaryQuery } from "@/lib/dashboard/queries";

export function LiveWorkStatus() {
  const { isRunning, isPaused, isIdle, elapsed, state, start, pause, resume, stop } = useWorkTimer();
  const queryClient = useQueryClient();

  const handleStop = async () => {
    const sessionData = stop();
    if (!sessionData) {
      toast.info("Timer reset (sessions under 3s are not saved)");
      return;
    }

    try {
      const res = await fetch("/api/time-tracker/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionData),
      });

      if (res.ok) {
        toast.success(`Work session saved: ${sessionData.project}`);
        void queryClient.invalidateQueries({ queryKey: dashboardSummaryQuery.queryKey });
        void queryClient.invalidateQueries({ queryKey: ["time-tracker", "sessions"] });
      } else {
        toast.error("Failed to save work session");
      }
    } catch {
      toast.error("Error saving work session");
    }
  };

  if (isIdle) {
    return (
      <button
        type="button"
        onClick={() => start("AI Venture")}
        className="hidden items-center gap-1.5 rounded-md border border-rule px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-rule-strong hover:bg-[var(--surface-2)]/60 hover:text-ink-strong sm:flex"
        title="Start manual work timer"
      >
        <Timer className="size-3.5 text-ink-faint" />
        <span>Track time</span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium transition-all shadow-xs",
        isRunning
          ? "border-[var(--accent-vivid)]/40 bg-[var(--accent-wash)] text-ink-strong"
          : "border-rule bg-[var(--surface-2)] text-ink-muted"
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          isRunning ? "bg-[var(--status-live)] animate-pulse" : "bg-[var(--status-warn)]"
        )}
      />

      <span className="font-mono tabular-nums text-ink-strong font-semibold">
        {formatTime(elapsed)}
      </span>

      <span className="hidden text-ink-muted sm:inline max-w-[100px] truncate">
        ({state.project || "AI Venture"})
      </span>

      <div className="flex items-center gap-0.5 ml-1 border-l border-rule pl-1.5">
        {isRunning ? (
          <button
            type="button"
            onClick={pause}
            className="rounded p-0.5 text-ink-muted hover:bg-[var(--surface-2)] hover:text-ink-strong"
            title="Pause timer"
          >
            <Pause className="size-3" />
          </button>
        ) : (
          <button
            type="button"
            onClick={resume}
            className="rounded p-0.5 text-ink-muted hover:bg-[var(--surface-2)] hover:text-ink-strong"
            title="Resume timer"
          >
            <Play className="size-3" />
          </button>
        )}

        <button
          type="button"
          onClick={handleStop}
          className="rounded p-0.5 text-ink-muted hover:bg-rose-500/10 hover:text-rose-600"
          title="Stop and save session"
        >
          <Square className="size-3" />
        </button>
      </div>
    </div>
  );
}
