"use client";

import * as React from "react";
import type { WorkSession } from "@/lib/time-tracker/types";
import { formatDurationHuman } from "@/lib/time-tracker/timer-store";
import { Clock, Trash2, Edit2, Check, X, Tag, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { dashboardSummaryQuery } from "@/lib/dashboard/queries";
import { cn } from "@/lib/utils";

interface WorkSessionsHistoryProps {
  sessions?: WorkSession[];
}

function formatTimeOnly(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function groupSessionsByDate(sessions: WorkSession[]): { label: string; date: string; items: WorkSession[]; totalSeconds: number }[] {
  const groups = new Map<string, WorkSession[]>();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  for (const s of sessions) {
    const dateStr = s.date || s.startTime?.slice(0, 10) || todayStr;
    if (!groups.has(dateStr)) groups.set(dateStr, []);
    groups.get(dateStr)!.push(s);
  }

  const result = [];
  for (const [dateStr, items] of groups.entries()) {
    let label = dateStr;
    if (dateStr === todayStr) label = "TODAY";
    else if (dateStr === yesterdayStr) label = "YESTERDAY";
    else {
      try {
        label = new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      } catch {
        label = dateStr;
      }
    }

    const totalSeconds = items.reduce((sum, item) => sum + item.duration, 0);
    result.push({ label, date: dateStr, items, totalSeconds });
  }

  return result;
}

export function WorkSessionsHistory({ sessions = [] }: WorkSessionsHistoryProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editProject, setEditProject] = React.useState("");
  const [editNote, setEditNote] = React.useState("");
  const queryClient = useQueryClient();

  const groups = React.useMemo(() => groupSessionsByDate(sessions), [sessions]);

  const handleStartEdit = (session: WorkSession) => {
    setEditingId(session.id);
    setEditProject(session.project || "AI Venture");
    setEditNote(session.note || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/time-tracker/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: editProject, note: editNote }),
      });

      if (res.ok) {
        toast.success("Work session updated");
        setEditingId(null);
        void queryClient.invalidateQueries({ queryKey: dashboardSummaryQuery.queryKey });
        void queryClient.invalidateQueries({ queryKey: ["time-tracker", "sessions"] });
      } else {
        toast.error("Failed to update session");
      }
    } catch {
      toast.error("Error updating session");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this work session?")) return;

    try {
      const res = await fetch(`/api/time-tracker/sessions/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Work session deleted");
        void queryClient.invalidateQueries({ queryKey: dashboardSummaryQuery.queryKey });
        void queryClient.invalidateQueries({ queryKey: ["time-tracker", "sessions"] });
      } else {
        toast.error("Failed to delete session");
      }
    } catch {
      toast.error("Error deleting session");
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col rounded-xl border border-rule bg-[var(--surface)] p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-rule/60">
          <h3 className="font-display text-sm font-semibold text-ink-strong uppercase tracking-wider">
            Work Sessions Log
          </h3>
          <span className="font-label text-xs text-ink-faint">0 sessions</span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock className="size-8 text-ink-faint/60 mb-2" />
          <p className="font-body-tight text-sm font-medium text-ink-strong">No work sessions recorded yet</p>
          <p className="font-body text-xs text-ink-muted mt-1 max-w-sm">
            Start the stopwatch above to track your focused sessions. When stopped, sessions automatically log here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-xl border border-rule bg-[var(--surface)] p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-rule/60">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-[var(--text-accent)]" />
          <h3 className="font-display text-sm font-semibold text-ink-strong uppercase tracking-wider">
            Work Sessions Log
          </h3>
        </div>
        <span className="font-label text-xs text-ink-muted">
          {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.date} className="flex flex-col gap-2">
            <div className="flex items-center justify-between font-label text-xs font-semibold text-ink-faint">
              <span>{group.label}</span>
              <span className="font-mono text-ink-muted">Total: {formatDurationHuman(group.totalSeconds)}</span>
            </div>

            <div className="flex flex-col divide-y divide-rule/60 rounded-lg border border-rule/60 bg-[var(--surface-2)]/30">
              {group.items.map((session) => {
                const isEditing = editingId === session.id;
                const timeRange = `${formatTimeOnly(session.startTime)} — ${formatTimeOnly(session.endTime)}`;

                return (
                  <div key={session.id} className="flex flex-col p-3 transition-colors hover:bg-[var(--surface-2)]/60">
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editProject}
                            onChange={(e) => setEditProject(e.target.value)}
                            placeholder="Project / Context"
                            className="rounded border border-rule bg-[var(--surface)] px-2 py-1 text-xs font-medium text-ink-strong focus:outline-hidden"
                          />
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            placeholder="Session note..."
                            className="flex-1 rounded border border-rule bg-[var(--surface)] px-2 py-1 text-xs text-ink-strong focus:outline-hidden"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="xs" variant="default" onClick={() => handleSaveEdit(session.id)}>
                            <Check className="size-3" /> Save
                          </Button>
                          <Button size="xs" variant="ghost" onClick={handleCancelEdit}>
                            <X className="size-3" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="mt-1 size-2 shrink-0 rounded-full bg-[var(--text-accent)]" />
                          <div className="flex flex-col min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-ink-strong">
                                {timeRange}
                              </span>
                              <span className="rounded bg-[var(--surface-2)] border border-rule px-1.5 py-0.5 font-label text-[10px] font-medium text-ink-muted">
                                {session.project}
                              </span>
                              <span className="font-mono text-xs text-[var(--text-accent)] font-medium">
                                {formatDurationHuman(session.duration)}
                              </span>
                            </div>
                            {session.note ? (
                              <p className="font-body text-xs text-ink-muted mt-0.5 truncate">
                                {session.note}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(session)}
                            className="rounded p-1 text-ink-faint hover:bg-[var(--surface-2)] hover:text-ink-strong"
                            title="Edit session"
                          >
                            <Edit2 className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(session.id)}
                            className="rounded p-1 text-ink-faint hover:bg-rose-500/10 hover:text-rose-600"
                            title="Delete session"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
