"use client";

import * as React from "react";
import { useWorkTimer, formatTime } from "@/lib/time-tracker/timer-store";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, RotateCcw, Sparkles, Tag, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { dashboardSummaryQuery } from "@/lib/dashboard/queries";
import { cn } from "@/lib/utils";

const PROJECT_PRESETS = [
  "AI Venture",
  "Research Lab",
  "Leads & Outreach",
  "Notes & Strategy",
  "Engineering & Agents",
  "Knowledge Base",
];

export function WorkStopwatch() {
  const {
    state,
    elapsed,
    isRunning,
    isPaused,
    isIdle,
    start,
    pause,
    resume,
    stop,
    reset,
    updateContext,
  } = useWorkTimer();

  const [customProject, setCustomProject] = React.useState(state.project || "AI Venture");
  const [sessionNote, setSessionNote] = React.useState(state.note || "");
  const [isSaving, setIsSaving] = React.useState(false);
  const queryClient = useQueryClient();

  // Synchronize local input state with store context
  React.useEffect(() => {
    setCustomProject(state.project || "AI Venture");
    setSessionNote(state.note || "");
  }, [state.project, state.note]);

  const handleProjectSelect = (proj: string) => {
    setCustomProject(proj);
    updateContext(proj, sessionNote);
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSessionNote(val);
    updateContext(customProject, val);
  };

  const handleStart = () => {
    start(customProject, sessionNote);
    toast.success(`Work timer started: ${customProject}`);
  };

  const handleStop = async () => {
    setIsSaving(true);
    const sessionData = stop(sessionNote);
    if (!sessionData) {
      setIsSaving(false);
      toast.info("Timer reset (sessions under 3 seconds are not saved)");
      return;
    }

    try {
      const res = await fetch("/api/time-tracker/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionData),
      });

      if (res.ok) {
        toast.success(`Work session saved (${Math.round(sessionData.duration / 60)}m on ${sessionData.project})`);
        setSessionNote("");
        void queryClient.invalidateQueries({ queryKey: dashboardSummaryQuery.queryKey });
        void queryClient.invalidateQueries({ queryKey: ["time-tracker", "sessions"] });
      } else {
        toast.error("Failed to save work session");
      }
    } catch {
      toast.error("Network error while saving session");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="stopwatch-section"
      className={cn(
        "relative flex flex-col justify-between overflow-hidden rounded-xl border p-5 transition-all duration-200",
        isRunning
          ? "border-[var(--accent-vivid)]/50 bg-[var(--accent-wash)]/40 shadow-sm ring-1 ring-[var(--accent-ring)]/30"
          : "border-rule bg-[var(--surface)] shadow-xs"
      )}
    >
      {/* Background glow when running */}
      {isRunning && (
        <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-[var(--text-accent)]/10 blur-3xl" />
      )}

      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2.5 rounded-full transition-all",
              isRunning
                ? "bg-[var(--status-live)] shadow-[0_0_8px_var(--status-live)] animate-pulse"
                : isPaused
                ? "bg-[var(--status-warn)]"
                : "bg-ink-faint"
            )}
          />
          <span className="font-label text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {isRunning ? "● WORKING / TRACKING TIME" : isPaused ? "⏸ TIMER PAUSED" : "○ MANUAL STOPWATCH"}
          </span>
        </div>

        {isRunning && (
          <span className="rounded-full bg-[var(--text-accent)]/10 px-2 py-0.5 font-label text-[11px] font-medium text-[var(--text-accent)]">
            Persisted Across Sections
          </span>
        )}
      </div>

      {/* Centerpiece Monospace Counter */}
      <div className="my-4 flex flex-col items-center justify-center">
        <div className="font-mono text-4xl font-extrabold tracking-tight text-ink-strong sm:text-5xl lg:text-6xl tabular-nums">
          {formatTime(elapsed)}
        </div>
        <p className="mt-1 font-body text-xs text-ink-faint">
          {isRunning
            ? `Active focus session on ${state.project}`
            : isPaused
            ? "Session paused · Resume or Stop to save"
            : "Set your context and click Start to begin focused work"}
        </p>
      </div>

      {/* Project Preset Selectors */}
      <div className="mb-3 flex flex-col gap-1.5">
        <span className="flex items-center gap-1 font-label text-[11px] font-medium text-ink-faint">
          <Tag className="size-3" /> Project / Context:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PROJECT_PRESETS.map((proj) => (
            <button
              key={proj}
              type="button"
              onClick={() => handleProjectSelect(proj)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-all",
                customProject === proj
                  ? "border-[var(--accent-vivid)] bg-[var(--text-accent)] text-white shadow-xs"
                  : "border-rule bg-[var(--surface-2)]/60 text-ink-muted hover:border-rule-strong hover:bg-[var(--surface-2)] hover:text-ink-strong"
              )}
            >
              {proj}
            </button>
          ))}
        </div>
      </div>

      {/* Session Note Field */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-rule bg-[var(--surface-2)]/40 px-3 py-1.5 focus-within:border-rule-strong focus-within:bg-[var(--surface)]">
        <FileText className="size-3.5 shrink-0 text-ink-faint" />
        <input
          type="text"
          value={sessionNote}
          onChange={handleNoteChange}
          placeholder="Optional session note (e.g. Outreach campaign draft, Market analysis)..."
          className="w-full bg-transparent font-body text-xs text-ink-strong placeholder:text-ink-faint focus:outline-hidden"
        />
      </div>

      {/* Action Button Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule/60 pt-3">
        <div className="flex items-center gap-2">
          {isIdle ? (
            <Button
              size="sm"
              variant="default"
              onClick={handleStart}
              className="gap-2 bg-[var(--text-accent)] font-semibold text-white shadow-xs hover:bg-[var(--text-accent)]/90"
            >
              <Play className="size-3.5 fill-current" />
              <span>START WORKING</span>
            </Button>
          ) : isRunning ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={pause}
                className="gap-1.5 border-rule-strong font-medium hover:bg-[var(--surface-2)]"
              >
                <Pause className="size-3.5" />
                <span>PAUSE</span>
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={isSaving}
                onClick={handleStop}
                className="gap-1.5 font-medium shadow-xs"
              >
                <Square className="size-3.5 fill-current" />
                <span>{isSaving ? "SAVING..." : "STOP & SAVE"}</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="default"
                onClick={resume}
                className="gap-1.5 bg-[var(--text-accent)] font-semibold text-white shadow-xs hover:bg-[var(--text-accent)]/90"
              >
                <Play className="size-3.5 fill-current" />
                <span>RESUME</span>
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={isSaving}
                onClick={handleStop}
                className="gap-1.5 font-medium shadow-xs"
              >
                <Square className="size-3.5 fill-current" />
                <span>{isSaving ? "SAVING..." : "STOP & SAVE"}</span>
              </Button>
            </>
          )}
        </div>

        {!isIdle && (
          <Button
            size="xs"
            variant="ghost"
            onClick={reset}
            className="gap-1 text-ink-faint hover:text-rose-500"
            title="Discard current session without saving"
          >
            <RotateCcw className="size-3" />
            <span>Discard</span>
          </Button>
        )}
      </div>
    </div>
  );
}
