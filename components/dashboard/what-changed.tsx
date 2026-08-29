"use client";

import * as React from "react";
import Link from "next/link";
import type { WhatChangedSummary } from "@/lib/dashboard/types";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatChangedProps {
  whatChanged?: WhatChangedSummary;
}

export function WhatChanged({ whatChanged }: WhatChangedProps) {
  const sinceLabel = whatChanged?.sinceLabel || "Since your last session";
  const items = whatChanged?.items || [];
  const hasChanges = whatChanged?.hasChanges && items.length > 0;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-rule bg-[var(--surface)] p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-rule/60 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-[var(--text-accent)]" />
          <h3 className="font-display text-sm font-semibold text-ink-strong uppercase tracking-wider">
            What Changed?
          </h3>
        </div>
        <span className="font-label text-xs text-ink-muted">
          {sinceLabel}
        </span>
      </div>

      <div className="my-4 flex flex-1 flex-col justify-center">
        {!hasChanges ? (
          <div className="flex items-center gap-2.5 py-3 text-ink-muted">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
            <p className="font-body text-sm">
              No major changes since your last session. Everything is up to date.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group flex items-center gap-2 rounded-lg border border-rule bg-[var(--surface-2)]/50 px-3 py-2 text-xs transition-all hover:border-rule-strong hover:bg-[var(--surface-2)] hover:shadow-xs"
              >
                <span className="font-mono font-bold text-[var(--text-accent)]">
                  +{item.count}
                </span>
                <span className="font-medium text-ink-strong">
                  {item.label.replace(/^\d+\s*/, "")}
                </span>
                <ArrowRight className="size-3 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink-strong" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-rule/60 pt-2.5 text-xs text-ink-faint">
        Activity deltas calculated automatically from real workspace events.
      </div>
    </div>
  );
}
