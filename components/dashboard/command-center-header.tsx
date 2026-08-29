"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  NotebookPen,
  Beaker,
  Lightbulb,
  FileText,
  Users,
  Workflow,
  Command,
  Timer,
  Clock,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { commandMenuStore } from "@/lib/command-menu-store";
import { useWorkTimer } from "@/lib/time-tracker/timer-store";
import type { ContextMessageInfo } from "@/lib/dashboard/types";
import { getContextualGreeting } from "@/lib/dashboard/context-messages";
import { cn } from "@/lib/utils";

interface CommandCenterHeaderProps {
  contextMessage?: ContextMessageInfo;
  syncedAt?: string;
}

export function CommandCenterHeader({
  contextMessage,
  syncedAt,
}: CommandCenterHeaderProps) {
  const [currentTime, setCurrentTime] = React.useState<Date | null>(null);
  const router = useRouter();
  const { start, isRunning } = useWorkTimer();

  React.useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const now = currentTime || new Date();
  const hour = now.getHours();
  const { greeting, subtitle } = getContextualGreeting(hour);

  const formattedDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const formattedClock = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ");

  const headline = contextMessage?.headline || greeting;
  const subtext = contextMessage?.subtext || subtitle;

  return (
    <div className="flex flex-col gap-5 border-b border-rule pb-6">
      {/* Top Banner Row: Time & Personal Context */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2 font-label text-ink-faint text-xs">
            <span className="flex items-center gap-1.5 font-medium text-ink-strong">
              <Clock className="size-3.5 text-[var(--text-accent)]" />
              {formattedDate}
            </span>
            <span>·</span>
            <span className="font-mono tabular-nums text-ink-muted">{formattedClock}</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden text-ink-faint sm:inline">{tzName}</span>
          </div>

          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-strong sm:text-3xl lg:text-4xl">
            {greeting}
          </h1>

          <p className="font-body text-sm text-ink-muted max-w-2xl">
            {subtitle}
            {syncedAt && (
              <span className="ml-1.5 text-xs text-ink-faint">
                (Synced {new Date(syncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
              </span>
            )}
          </p>
        </div>

        {/* Intelligent Contextual Message Card */}
        <div className="flex max-w-md flex-col gap-1 rounded-lg border border-rule bg-[var(--surface-2)]/60 p-3.5 backdrop-blur-xs transition-all hover:border-rule-strong">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-label text-xs font-semibold uppercase tracking-wider text-[var(--text-accent)]">
              <Sparkles className="size-3 text-[var(--text-accent)]" />
              {contextMessage?.badge || "Operating Context"}
            </span>
            <span className="size-1.5 rounded-full bg-[var(--status-live)]" />
          </div>
          <p className="font-body-tight text-sm font-semibold text-ink-strong">
            &ldquo;{headline}&rdquo;
          </p>
          <p className="font-body text-xs text-ink-muted">
            {subtext}
          </p>
        </div>
      </div>

      {/* Quick Action Command Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/notepad?new=1")}
            className="gap-1.5 text-xs font-medium"
          >
            <NotebookPen className="size-3.5 text-ink-muted" />
            <span>New note</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/research-lab")}
            className="gap-1.5 text-xs font-medium"
          >
            <Beaker className="size-3.5 text-ink-muted" />
            <span>Research Lab</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/brainstorm-sketch")}
            className="gap-1.5 text-xs font-medium"
          >
            <Lightbulb className="size-3.5 text-ink-muted" />
            <span>New board</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/documents?upload=1")}
            className="gap-1.5 text-xs font-medium"
          >
            <FileText className="size-3.5 text-ink-muted" />
            <span>Upload file</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/leads?new=1")}
            className="gap-1.5 text-xs font-medium"
          >
            <Users className="size-3.5 text-ink-muted" />
            <span>Add lead</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/todoist?new=1")}
            className="gap-1.5 text-xs font-medium"
          >
            <Workflow className="size-3.5 text-ink-muted" />
            <span>New task</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {!isRunning && (
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                start("AI Venture");
                const el = document.getElementById("stopwatch-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="gap-1.5 text-xs bg-[var(--text-accent)] text-white hover:bg-[var(--text-accent)]/90"
            >
              <Timer className="size-3.5" />
              <span>Start work timer</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => commandMenuStore.open()}
            className="gap-1.5 text-xs text-ink-muted hover:text-ink-strong"
          >
            <Command className="size-3.5" />
            <span className="hidden sm:inline">Command palette</span>
            <kbd className="rounded border border-rule bg-[var(--surface-2)] px-1 font-mono text-[10px] text-ink-faint">
              ⌘K
            </kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}
