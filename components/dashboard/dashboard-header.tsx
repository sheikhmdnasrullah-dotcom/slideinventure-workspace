"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { NotebookPen, Beaker, Lightbulb, FileText, Users, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { commandMenuStore } from "@/lib/command-menu-store";

/**
 * Dashboard header. States the date and local time, then the six actions worth
 * one click. No greeting, no generated encouragement, no context card — those
 * were assumptions about the user's state, not information.
 *
 * The clock renders `null` on the server and fills in on mount so it shows the
 * viewer's own timezone without a hydration mismatch.
 */

const QUICK_ACTIONS = [
  { label: "Note", href: "/notepad?new=1", icon: NotebookPen },
  { label: "Research", href: "/research-lab", icon: Beaker },
  { label: "Board", href: "/brainstorm-sketch", icon: Lightbulb },
  { label: "Upload", href: "/documents?upload=1", icon: FileText },
  { label: "Lead", href: "/leads?new=1", icon: Users },
  { label: "Task", href: "/todoist?new=1", icon: CheckSquare },
] as const;

/**
 * Ticks once every 30s. Subscribing via `useSyncExternalStore` keeps the clock
 * out of an effect and lets the server render nothing (`null`) so local time is
 * only ever produced on the client — no hydration mismatch, no cascading render.
 */
function subscribeToClock(onChange: () => void) {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
}

export function DashboardHeader() {
  const router = useRouter();
  const nowMs = React.useSyncExternalStore(
    subscribeToClock,
    () => Math.floor(Date.now() / 30_000) * 30_000,
    () => null
  );

  const stamp = React.useMemo(() => {
    if (nowMs === null) return "";
    const now = new Date(nowMs);
    const date = now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const clock = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${date} · ${clock}`;
  }, [nowMs]);

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-xl font-semibold tracking-tight text-ink-strong">
          Dashboard
        </h1>
        <p className="font-mono text-xs tabular-nums text-ink-muted" suppressHydrationWarning>
          {stamp || "\u00a0"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
          <Button
            key={label}
            size="sm"
            variant="outline"
            onClick={() => router.push(href)}
            className="gap-1.5 text-xs font-normal"
          >
            <Icon className="size-3.5 text-ink-faint" />
            {label}
          </Button>
        ))}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => commandMenuStore.open()}
          className="gap-1.5 text-xs font-normal text-ink-muted"
        >
          Search
          <kbd className="rounded border border-rule px-1 font-mono text-[10px] text-ink-faint">
            ⌘K
          </kbd>
        </Button>
      </div>
    </header>
  );
}
