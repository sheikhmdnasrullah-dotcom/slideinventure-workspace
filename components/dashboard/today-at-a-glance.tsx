"use client";

import * as React from "react";
import Link from "next/link";
import { formatDurationHuman } from "@/lib/time-tracker/timer-store";
import type { TodayMetrics } from "@/lib/dashboard/types";
import {
  Timer,
  CheckCircle2,
  PlusCircle,
  Beaker,
  Bot,
  Users,
  NotebookPen,
  Calendar,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TodayAtAGlanceProps {
  today?: TodayMetrics;
}

export function TodayAtAGlance({ today }: TodayAtAGlanceProps) {
  const dateFormatted = today?.dateFormatted || new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const tiles = [
    {
      id: "focus-time",
      label: "Focus time",
      value: formatDurationHuman(today?.focusTimeSeconds ?? 0),
      icon: Timer,
      href: "#stopwatch-section",
      highlight: true,
      color: "text-[var(--text-accent)]",
      bg: "bg-[var(--accent-wash)]/40 border-[var(--accent-vivid)]/30",
    },
    {
      id: "sessions",
      label: "Sessions",
      value: String(today?.sessionsCount ?? 0),
      icon: Layers,
      href: "#stopwatch-section",
      color: "text-ink-strong",
      bg: "bg-[var(--surface)] border-rule",
    },
    {
      id: "completed",
      label: "Completed",
      value: String(today?.completedTasks ?? 0),
      icon: CheckCircle2,
      href: "/todoist",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-[var(--surface)] border-rule",
    },
    {
      id: "created",
      label: "Created",
      value: String(today?.createdItems ?? 0),
      icon: PlusCircle,
      href: "/activity",
      color: "text-sky-600 dark:text-sky-400",
      bg: "bg-[var(--surface)] border-rule",
    },
    {
      id: "research",
      label: "Research updates",
      value: String(today?.researchUpdates ?? 0),
      icon: Beaker,
      href: "/research-lab",
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-[var(--surface)] border-rule",
    },
    {
      id: "agents",
      label: "Agent runs",
      value: String(today?.agentRuns ?? 0),
      icon: Bot,
      href: "/agents",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-[var(--surface)] border-rule",
    },
    {
      id: "leads",
      label: "New leads",
      value: String(today?.newLeads ?? 0),
      icon: Users,
      href: "/leads",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-[var(--surface)] border-rule",
    },
    {
      id: "notes",
      label: "Notes",
      value: String(today?.notesCount ?? 0),
      icon: NotebookPen,
      href: "/notepad",
      color: "text-ink-strong",
      bg: "bg-[var(--surface)] border-rule",
    },
  ];

  return (
    <div className="flex flex-col rounded-xl border border-rule bg-[var(--surface)] p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-rule/60 pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-[var(--text-accent)]" />
          <h3 className="font-display text-sm font-semibold text-ink-strong uppercase tracking-wider">
            Today at a Glance
          </h3>
        </div>
        <span className="font-label text-xs font-medium text-ink-muted">
          {dateFormatted}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.id}
              href={tile.href}
              className={cn(
                "group flex flex-col justify-between rounded-lg border p-3 transition-all hover:border-rule-strong hover:shadow-xs",
                tile.bg
              )}
            >
              <div className="flex items-center justify-between">
                <Icon className={cn("size-4 shrink-0", tile.color)} />
                <ArrowUpRight className="size-3 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
              </div>

              <div className="mt-3 flex flex-col">
                <span className={cn("font-mono text-xl font-bold tracking-tight", tile.color)}>
                  {tile.value}
                </span>
                <span className="font-label text-[11px] text-ink-muted truncate mt-0.5">
                  {tile.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
