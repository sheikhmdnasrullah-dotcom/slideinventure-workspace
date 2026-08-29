"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NextBestAction as NextBestActionType } from "@/lib/dashboard/types";
import { Zap, ArrowRight, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkTimer } from "@/lib/time-tracker/timer-store";

interface NextBestActionProps {
  actions?: NextBestActionType[];
}

export function NextBestAction({ actions = [] }: NextBestActionProps) {
  const router = useRouter();
  const { start } = useWorkTimer();

  const handleActionClick = (action: NextBestActionType) => {
    if (action.href === "#stopwatch") {
      start("AI Venture");
      const el = document.getElementById("stopwatch-section");
      el?.scrollIntoView({ behavior: "smooth" });
    } else {
      router.push(action.href);
    }
  };

  return (
    <div className="flex flex-col justify-between rounded-xl border border-rule bg-[var(--surface)] p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-rule/60 pb-3">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-[var(--text-accent)]" />
          <h3 className="font-display text-sm font-semibold text-ink-strong uppercase tracking-wider">
            Next Best Move
          </h3>
        </div>
        <span className="font-label text-xs font-semibold text-[var(--text-accent)] uppercase tracking-wider">
          High Leverage
        </span>
      </div>

      <div className="my-4 flex flex-1 flex-col gap-3">
        {actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-ink-muted">
            <Sparkles className="size-6 text-[var(--text-accent)] mb-1.5" />
            <p className="font-body text-sm font-medium text-ink-strong">All recommendations cleared</p>
            <p className="font-body text-xs text-ink-faint mt-1">
              Start a new research sprint or capture notes to receive high-leverage next move suggestions.
            </p>
          </div>
        ) : (
          actions.map((action, idx) => (
            <div
              key={action.id || idx}
              className="flex flex-col justify-between gap-3 rounded-lg border border-rule/80 bg-[var(--surface-2)]/40 p-3.5 transition-all hover:border-rule-strong hover:bg-[var(--surface-2)]/70"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-body-tight text-sm font-bold text-ink-strong">
                    {action.title}
                  </span>
                  {action.priority === "high" && (
                    <span className="rounded bg-[var(--accent-wash)] px-1.5 py-0.5 font-label text-[10px] font-semibold text-[var(--text-accent)]">
                      Top Priority
                    </span>
                  )}
                </div>
                <p className="font-body text-xs text-ink-muted leading-relaxed">
                  <span className="font-semibold text-ink-faint">Reason:</span> {action.reason}
                </p>
              </div>

              <div className="flex items-center justify-end pt-1">
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => handleActionClick(action)}
                  className="gap-1.5 bg-[var(--text-accent)] font-semibold text-white shadow-xs hover:bg-[var(--text-accent)]/90"
                >
                  <span>{action.actionLabel || "Execute Move"}</span>
                  <ArrowRight className="size-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-rule/60 pt-2.5 text-xs text-ink-faint">
        Derived algorithmically from open loops, pending uploads, and research velocity.
      </div>
    </div>
  );
}
