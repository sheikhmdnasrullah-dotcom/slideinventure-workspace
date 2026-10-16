"use client";

import Link from "next/link";
import { agentIcon } from "@/lib/agents/pipeline";
import type { NormalizedAgent } from "@/lib/agents/pipeline";
import { cn } from "@/lib/utils";

export function AgentCard({ agent }: { agent: NormalizedAgent }) {
  const badgeTone =
    agent.framework === "Mastra"
      ? "bg-status-live-bg text-status-live"
      : "bg-status-neutral-bg text-status-neutral";

  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="group flex flex-col items-center gap-2 rounded-lg border border-rule bg-surface p-6 text-center shadow-raised transition-shadow duration-[150ms] hover:shadow-float"
    >
      <span className="flex size-14 items-center justify-center rounded-md bg-surface-2 text-ink-strong">
        {agentIcon(agent, "size-7")}
      </span>
      <span className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-ink-strong">{agent.name}</span>
      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", badgeTone)}>
        {agent.framework}
      </span>
    </Link>
  );
}
