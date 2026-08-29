"use client";

import * as React from "react";
import Link from "next/link";
import type { AttentionItem } from "@/lib/dashboard/types";
import { AlertCircle, AlertTriangle, CheckCircle2, ArrowRight, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface NeedsAttentionProps {
  items?: AttentionItem[];
}

export function NeedsAttention({ items = [] }: NeedsAttentionProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-rule bg-[var(--surface)] p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-rule/60 pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-amber-500" />
          <h3 className="font-display text-sm font-semibold text-ink-strong uppercase tracking-wider">
            Needs Attention
          </h3>
        </div>
        <span className="font-label text-xs text-ink-muted">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="my-4 flex flex-1 flex-col gap-2.5">
        {items.length === 0 ? (
          <div className="flex items-center gap-2.5 py-4 text-ink-muted">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
            <p className="font-body text-sm">
              All clear. No urgent blockers or overdue items requiring attention.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const isHigh = item.severity === "high";
            const isMedium = item.severity === "medium";
            const isGood = item.severity === "good";

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "group flex items-center justify-between gap-3 rounded-lg border p-3 transition-all hover:shadow-xs",
                  isHigh
                    ? "border-rose-500/30 bg-rose-500/5 hover:border-rose-500/50"
                    : isMedium
                    ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                    : "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50"
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  {isHigh ? (
                    <AlertCircle className="mt-0.5 size-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  ) : isMedium ? (
                    <AlertTriangle className="mt-0.5 size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}

                  <div className="flex flex-col min-w-0">
                    <span className="truncate font-body-tight text-sm font-semibold text-ink-strong">
                      {item.title}
                    </span>
                    <span className="font-body text-xs text-ink-muted line-clamp-1">
                      {item.description}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 font-label text-xs font-medium text-ink-faint group-hover:text-ink-strong shrink-0">
                  <span>{item.actionLabel || "Review"}</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })
        )}
      </div>

      <div className="border-t border-rule/60 pt-2.5 text-xs text-ink-faint">
        Ranked automatically by urgency based on deadline, failure state, and synthesis needs.
      </div>
    </div>
  );
}
