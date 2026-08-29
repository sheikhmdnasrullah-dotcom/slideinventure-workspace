"use client";

import Link from "next/link";
import { agentIcon } from "@/lib/agents/pipeline";
import type { NormalizedAgent } from "@/lib/agents/pipeline";
import { cn } from "@/lib/utils";

export function AgentCard({ agent }: { agent: NormalizedAgent }) {
  const badgeTone =
    agent.framework === "Mastra"
      ? "bg-emerald-500/10 text-emerald-500"
      : "bg-sky-500/10 text-sky-500";

  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="group flex flex-col items-center gap-2 rounded-md border border-rule bg-[var(--surface)] p-4 text-center transition-all duration-base ease-std hover:-translate-y-0.5 hover:border-[var(--text-accent)] hover:shadow-[var(--shadow-float)]"
    >
      <span className="flex size-14 items-center justify-center rounded-xl bg-[var(--surface-2)] text-ink-strong">
        {agentIcon(agent, "size-7")}
      </span>
      <span className="font-label text-sm font-medium text-ink-strong leading-tight">{agent.name}</span>
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide", badgeTone)}>
        {agent.framework}
      </span>
    </Link>
  );
}
