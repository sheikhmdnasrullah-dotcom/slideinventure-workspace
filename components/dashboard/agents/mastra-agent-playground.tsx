"use client";

import { useState } from "react";
import { Play, Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/system";
import { derivePipeline, type NormalizedAgent } from "@/lib/agents/pipeline";
import type { MastraCatalogAgent } from "@/lib/agents/mastra-catalog";
import { cn } from "@/lib/utils";

type StepStatus = "idle" | "running" | "done";

const STATUS_RING: Record<StepStatus, string> = {
  idle: "border-rule",
  running: "border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.45)]",
  done: "border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.4)]",
};

export function MastraAgentPlayground({ agent }: { agent: MastraCatalogAgent }) {
  const normalized: NormalizedAgent = {
    slug: agent.slug,
    name: agent.name,
    framework: "Mastra",
    description: agent.description,
    emoji: agent.emoji,
    color: agent.color,
    tools: agent.tools,
    model: agent.modelId,
  };
  const steps = derivePipeline(normalized);

  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [answer, setAnswer] = useState("");
  const [toolCalls, setToolCalls] = useState<string[]>([]);
  const [status, setStatus] = useState<Record<string, StepStatus>>({
    trigger: "idle",
    research: "idle",
    reason: "idle",
    seek: "idle",
  });

  const hasResearch = (agent.tools ?? []).some((t) => /(search|web|browser|browse|research|tavily|crawl)/i.test(t));

  async function run() {
    if (!task.trim() || running) return;
    setRunning(true);
    setAnswer("");
    setToolCalls([]);
    setStatus({
      trigger: "done",
      research: hasResearch ? "running" : "idle",
      reason: "running",
      seek: "idle",
    });
    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: agent.slug, message: task, tools: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || `Agent error (${res.status})`);
      setAnswer(data.answer || "");
      setToolCalls(data.tools ?? []);
      setStatus((s) => ({ ...s, research: hasResearch ? "done" : "idle", reason: "done", seek: "done" }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setAnswer(`Error: ${msg}`);
      setStatus((s) => ({ ...s, reason: "idle", seek: "idle" }));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-rule px-4 py-3">
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
          }}
          placeholder={`Describe what you want ${agent.name} to do…  (⌘/Ctrl+Enter to run)`}
          rows={1}
          className="min-w-[280px] flex-1 resize-none rounded-md border border-rule bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <Button onClick={run} disabled={running || !task.trim()}>
          {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {running ? "Running" : "Run"}
        </Button>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-auto p-4 lg:grid-cols-[1fr_320px]">
        {/* Workflow ground */}
        <div>
          <div className="mb-2 font-label text-[11px] uppercase tracking-wide text-ink-muted">Workflow</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {steps.map((s) => (
              <div key={s.key} className={cn("rounded-md border bg-[var(--surface-2)] p-3", STATUS_RING[status[s.key]])}>
                <div className="font-label text-xs font-semibold text-ink-strong">{s.label}</div>
                <p className="mt-1 font-body text-xs text-ink-muted leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>

          {answer && (
            <div className="mt-4 rounded-md border border-emerald-400/40 bg-emerald-400/5 p-3">
              <div className="mb-1 font-label text-xs font-semibold text-emerald-300">Output</div>
              <p className="whitespace-pre-wrap font-body text-sm text-ink-strong">{answer}</p>
            </div>
          )}
        </div>

        {/* Side: model + tools + tool calls */}
        <div className="space-y-3 text-xs">
          <div>
            <div className="mb-1 font-label text-[11px] uppercase tracking-wide text-ink-muted">Runtime</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge tone="live" label="Mastra · VPS" />
              {agent.modelId && (
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 font-label text-[11px] text-ink-muted">
                  {agent.modelId}
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1 font-label text-[11px] uppercase tracking-wide text-ink-muted">Tools</div>
            <div className="flex flex-wrap gap-1.5">
              {(agent.tools ?? []).length ? (
                agent.tools!.map((t) => (
                  <span key={t} className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 font-label text-[11px] text-ink-muted">
                    {t.replace(/[_-]/g, " ")}
                  </span>
                ))
              ) : (
                <span className="text-ink-muted">No tools connected.</span>
              )}
            </div>
          </div>

          {toolCalls.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-1 font-label text-[11px] uppercase tracking-wide text-ink-muted">
                <Wrench className="size-3" /> Tool calls
              </div>
              <ul className="space-y-1">
                {toolCalls.map((t, i) => (
                  <li key={i} className="rounded bg-[var(--surface-2)] px-2 py-1 font-label text-[11px] text-ink-strong">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
