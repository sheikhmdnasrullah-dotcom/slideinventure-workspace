"use client";

import * as React from "react";
import type { WorkSession } from "@/lib/time-tracker/types";
import { formatDurationHuman } from "@/lib/time-tracker/timer-store";
import { Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { dashboardSummaryQuery } from "@/lib/dashboard/queries";
import { Panel, PanelEmpty } from "@/components/dashboard/panel";
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
      <Panel title="Sessions" meta="0">
        <PanelEmpty hint="Stopped sessions are logged here automatically.">
          No sessions recorded yet.
        </PanelEmpty>
      </Panel>
    );
  }

  return (
    <Panel
      title="Sessions"
      meta={`${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`}
      bodyClassName="gap-5 p-0"
    >
      <div className="flex flex-col">
        {groups.map((group) => (
          <div key={group.date} className="flex flex-col">
            <div className="flex items-center justify-between border-b border-rule bg-[var(--surface-2)]/60 px-4 py-1.5">
              <span className="font-label text-xs text-ink-faint">{group.label}</span>
              <span className="font-mono text-xs tabular-nums text-ink-muted">
                {formatDurationHuman(group.totalSeconds)}
              </span>
            </div>

            <div className="flex flex-col divide-y divide-rule">
              {group.items.map((session) => {
                const isEditing = editingId === session.id;
                const timeRange = `${formatTimeOnly(session.startTime)} – ${formatTimeOnly(session.endTime)}`;

                return (
                  <div key={session.id} className="group flex flex-col px-4 py-2.5">
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={editProject}
                            onChange={(e) => setEditProject(e.target.value)}
                            placeholder="Context"
                            aria-label="Session context"
                            className="rounded-md border border-rule bg-[var(--surface-2)] px-2 py-1 font-body text-xs text-ink-strong focus:border-rule-strong focus:outline-hidden"
                          />
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            placeholder="Note"
                            aria-label="Session note"
                            className="flex-1 rounded-md border border-rule bg-[var(--surface-2)] px-2 py-1 font-body text-xs text-ink-strong focus:border-rule-strong focus:outline-hidden"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="xs" onClick={() => handleSaveEdit(session.id)} className="text-xs">
                            Save
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            className="text-xs font-normal text-ink-muted"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-3">
                        <span className="shrink-0 font-mono text-xs tabular-nums text-ink-muted">
                          {timeRange}
                        </span>

                        <span className="min-w-0 flex-1 truncate font-body-tight text-sm text-ink-strong">
                          {session.project}
                          {session.note ? (
                            <span className="text-ink-muted"> · {session.note}</span>
                          ) : null}
                        </span>

                        <span className="shrink-0 font-mono text-xs tabular-nums text-ink-strong">
                          {formatDurationHuman(session.duration)}
                        </span>

                        <span
                          className={cn(
                            "flex shrink-0 items-center gap-0.5 transition-opacity",
                            "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => handleStartEdit(session)}
                            className="rounded p-1 text-ink-faint hover:text-ink-strong"
                            aria-label={`Edit session ${timeRange}`}
                          >
                            <Edit2 className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(session.id)}
                            className="rounded p-1 text-ink-faint hover:text-[var(--status-danger)]"
                            aria-label={`Delete session ${timeRange}`}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
