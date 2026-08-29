"use client";

import { useState } from "react";
import { Info, Bot } from "lucide-react";
import { AgentIcon } from "@/components/dashboard/agent-icon";
import { AgentDetailDialog } from "./agent-detail-dialog";
import type { NormalizedAgent } from "@/lib/agents/pipeline";
import { cn } from "@/lib/utils";

export function AgentCard({ agent }: { agent: NormalizedAgent }) {
  const [open, setOpen] = useState(false);
  const usePersonaIcon = agent.framework === "Claude" && !!agent.iconSlug;
  const badgeTone =
    agent.framework === "Mastra"
      ? "bg-emerald-500/10 text-emerald-500"
      : "bg-sky-500/10 text-sky-500";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group relative flex flex-col items-center gap-2 rounded-md border border-rule bg-[var(--surface)] p-4 text-center transition-all duration-base ease-std hover:-translate-y-0.5 hover:border-[var(--text-accent)] hover:shadow-[var(--shadow-float)]"
      >
        <span className="absolute right-2 top-2 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
          <Info className="size-4" />
        </span>
        <span className="flex size-14 items-center justify-center rounded-xl bg-[var(--surface-2)] text-ink-strong">
          {usePersonaIcon ? <AgentIcon slug={agent.iconSlug!} className="size-7" /> : <Bot className="size-7" />}
        </span>
        <span className="font-label text-sm font-medium text-ink-strong leading-tight">{agent.name}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide", badgeTone)}>
          {agent.framework}
        </span>
      </button>
      <AgentDetailDialog agent={agent} open={open} onOpenChange={setOpen} />
    </>
  );
}
