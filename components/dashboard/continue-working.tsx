"use client";

import * as React from "react";
import Link from "next/link";
import type { ContinueItem } from "@/lib/dashboard/types";
import {
  Compass,
  ArrowRight,
  Beaker,
  Lightbulb,
  NotebookPen,
  FileText,
  Rocket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContinueWorkingProps {
  items?: ContinueItem[];
}

const CATEGORY_ICON: Record<string, LucideIcon> = {
  research: Beaker,
  brainstorm: Lightbulb,
  notes: NotebookPen,
  documents: FileText,
  concepts: Rocket,
  leads: Users,
};

export function ContinueWorking({ items = [] }: ContinueWorkingProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-rule bg-[var(--surface)] p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-rule/60 pb-3">
        <div className="flex items-center gap-2">
          <Compass className="size-4 text-[var(--text-accent)]" />
          <h3 className="font-display text-sm font-semibold text-ink-strong uppercase tracking-wider">
            Continue Where You Left Off
          </h3>
        </div>
        <span className="font-label text-xs text-ink-muted">
          Recent Focus
        </span>
      </div>

      <div className="my-4 flex flex-1 flex-col gap-2.5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-ink-muted">
            <p className="font-body text-sm">No recent items to resume yet.</p>
            <p className="font-body text-xs text-ink-faint mt-1">
              As you create notes, research items, and boards, quick resume links will populate here.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const Icon = CATEGORY_ICON[item.category] || FileText;
            return (
              <Link
                key={item.id}
                href={item.href}
                className="group flex items-center justify-between gap-3 rounded-lg border border-rule/60 bg-[var(--surface-2)]/30 p-3 transition-all hover:border-rule-strong hover:bg-[var(--surface-2)]/80 hover:shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-rule bg-[var(--surface)] text-[var(--text-accent)]">
                    <Icon className="size-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="truncate font-body-tight text-sm font-semibold text-ink-strong group-hover:text-[var(--text-accent)] transition-colors">
                      {item.title}
                    </span>
                    <span className="font-label text-[11px] text-ink-faint truncate">
                      {item.lastOpenedLabel}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 font-label text-xs font-medium text-ink-faint group-hover:text-ink-strong shrink-0">
                  <span>Resume</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })
        )}
      </div>

      <div className="border-t border-rule/60 pt-2.5 text-xs text-ink-faint">
        Click any artifact to jump directly back into the editor or canvas.
      </div>
    </div>
  );
}
