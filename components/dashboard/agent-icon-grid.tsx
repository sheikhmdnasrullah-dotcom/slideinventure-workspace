"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { RosterAgent } from "@/lib/agents/roster";
import { AgentIcon } from "@/components/dashboard/agent-icon";
import { cn } from "@/lib/utils";

function tint(hex: string | null): { bg: string; ring: string } {
  const c = hex || "#6366f1";
  return {
    bg: `color-mix(in oklch, ${c} 14%, transparent)`,
    ring: `color-mix(in oklch, ${c} 45%, transparent)`,
  };
}

export function AgentIconGrid({ agents }: { agents: RosterAgent[] }) {
  const router = useRouter();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {agents.map((a) => {
        const t = tint(a.color);
        // The lead research assistant is a real dashboard tool (CSV upload,
        // free-text research, writes into the Leads table), not a generic
        // persona chat canvas, so it opens the Leads page's assistant panel
        // instead of the standard /agents/[slug] workflow canvas.
        const href = a.slug === "lead-research-assistant" ? "/leads?assistant=1" : `/agents/${a.slug}`
        return (
          <button
            key={a.slug}
            onClick={() => router.push(href)}
            className="group flex flex-col items-center gap-2 rounded-md border border-rule bg-[var(--surface)] p-4 text-center transition-all duration-base ease-std hover:-translate-y-0.5 hover:border-[var(--text-accent)] hover:shadow-[var(--shadow-float)]"
          >
            <span
              className="flex size-14 items-center justify-center rounded-xl text-ink-strong"
              style={{ background: t.bg, boxShadow: `inset 0 0 0 1px ${t.ring}` }}
            >
              <AgentIcon slug={a.slug} className="size-7" />
            </span>
            <span className="font-label text-sm font-medium text-ink-strong leading-tight">
              {a.name}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide"
              style={{ background: t.bg, color: a.color || "var(--text-accent)" }}
            >
              {a.division}
            </span>
          </button>
        );
      })}
    </div>
  );
}
