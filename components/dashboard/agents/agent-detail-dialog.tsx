"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/system";
import type { NormalizedAgent } from "@/lib/agents/pipeline";
import { derivePipeline } from "@/lib/agents/pipeline";

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
      </DialogContent>
    </Dialog>
  );
}
