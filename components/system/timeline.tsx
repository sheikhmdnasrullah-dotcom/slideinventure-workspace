"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { StatusBadge, type StatusTone } from "@/components/system/status-badge";

/**
 * Timeline — the vertical activity feed. Each item is a row on a rule, with a
 * tone dot at the left edge (the position in the timeline), a label, an
 * optional description, a tone badge, and a right-aligned timestamp. The
 * opposite of the "stack of cards" feed: a single ruled surface holding many
 * entries, the density the brief calls for.
 */
export type TimelineItem = {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: StatusTone;
  time?: string | Date;
  href?: string;
};

export function Timeline({
  items,
  className,
  inferTimeLabel,
}: {
  items: TimelineItem[];
  className?: string;
  inferTimeLabel?: (time: string | Date) => string | undefined;
}) {
  return (
    <ol
      data-slot="timeline"
      className={cn("flex flex-col", className)}
      role="list"
    >
      {items.map((item) => {
        const timeLabel =
          item.time != null
            ? inferTimeLabel?.(item.time) ??
              (typeof item.time === "string"
                ? new Date(item.time).toLocaleString()
                : item.time.toLocaleString())
            : undefined;
        const inner = (
          <>
            <span
              className={cn(
                "mt-1.5 size-1.5 shrink-0 rounded-full",
                item.tone === "live" ? "bg-[var(--status-live)] animate-pulse"
                  : item.tone === "danger" ? "bg-[var(--status-danger)]"
                  : item.tone === "warn" ? "bg-[var(--status-warn)]"
                  : item.tone === "info" ? "bg-[var(--status-info)]"
                  : item.tone === "flame" ? "bg-[var(--text-accent)]"
                  : "bg-ink-faint"
              )}
              aria-hidden
            />
            <div className="flex flex-1 flex-col gap-1 pb-3">
              <div className="flex items-start justify-between gap-3">
                <span className="font-body-tight text-sm text-ink-strong">
                  {item.title}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {item.tone && <StatusBadge tone={item.tone} />}
                  {timeLabel && (
                    <span className="font-label tabular-nums text-ink-faint">
                      {timeLabel}
                    </span>
                  )}
                </div>
              </div>
              {item.description && (
                <p className="font-body text-sm text-ink-muted">
                  {item.description}
                </p>
              )}
            </div>
          </>
        );
        return (
          <li
            key={item.id}
            data-slot="timeline-item"
            className="flex gap-3 border-l border-rule pl-3 last:border-transparent"
          >
            {item.href ? (
              <Link href={item.href} className="flex w-full gap-3 transition-colors hover:bg-[var(--surface-2)]/50">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ol>
  );
}
