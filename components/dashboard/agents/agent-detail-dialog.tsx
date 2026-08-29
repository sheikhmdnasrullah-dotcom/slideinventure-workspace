"use client";

import Link from "next/link";
import { Rocket, Play } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/system";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { NormalizedAgent } from "@/lib/agents/pipeline";
import { derivePipeline } from "@/lib/agents/pipeline";
import { deployAgent, type DeployableAgent } from "@/lib/agents/deployed-agent-store";

function toDeployable(a: NormalizedAgent): DeployableAgent {
  return {
    slug: a.slug,
    name: a.name,
    emoji: a.emoji || (a.framework === "Mastra" ? "🛰️" : "🤖"),
    color: a.color || (a.framework === "Mastra" ? "#22d3ee" : "#6366f1"),
    description: a.description,
    runtime: a.framework === "Mastra" ? "mastra" : "claude",
  };
}

export function AgentDetailDialog({
  agent,
  open,
  onOpenChange,
}: {
  agent: NormalizedAgent;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const steps = derivePipeline(agent);

  const handleDeploy = () => {
    deployAgent(toDeployable(agent));
    toast.success(`${agent.name} deployed`, {
      description: "Drag the floating avatar anywhere, or tap it to open and run a task.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{agent.name}</DialogTitle>
            <StatusBadge tone={agent.framework === "Mastra" ? "live" : "info"} label={agent.framework} />
          </div>
          <DialogDescription>{agent.description || "No description provided."}</DialogDescription>
        </DialogHeader>

        <div>
          <div className="font-label text-[11px] uppercase tracking-wide text-ink-muted mb-2">Workflow</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {steps.map((s) => (
              <div key={s.key} className="rounded-md border border-rule bg-[var(--surface-2)] p-3">
                <div className="font-label text-xs font-semibold text-ink-strong">{s.label}</div>
                <p className="mt-1 font-body text-xs text-ink-muted leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>

        {(agent.tools?.length || agent.model) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {agent.model && (
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 font-label text-[11px] text-ink-muted">
                Model · {agent.model}
              </span>
            )}
            {agent.tools?.map((t) => (
              <span
                key={t}
                className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 font-label text-[11px] text-ink-muted"
              >
                {t.replace(/[_-]/g, " ")}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button onClick={handleDeploy}>
            <Rocket className="size-4" />
            Deploy
          </Button>
          {agent.framework === "Claude" && (
            <Button variant="outline" render={<Link href={`/agents/${agent.slug}`} />} onClick={() => onOpenChange(false)}>
              <Play className="size-4" />
              Run
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
