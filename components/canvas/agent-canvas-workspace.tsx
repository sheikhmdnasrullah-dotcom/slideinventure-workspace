"use client";

import * as React from "react";
import { Mail, Search } from "lucide-react";
import { AgentFlowCanvas, type StageStatus } from "@/components/canvas/agent-flow-canvas";
import { AGENT_STAGES, type AgentStage, emitRunStarted, emitRunFinished, emitRunError } from "@/lib/agui/bus";
import { ShimmerButton } from "@/components/ui/magicui/shimmer-button";
import { LeadResearchAssistantPanel } from "@/components/dashboard/leads/lead-research-assistant";
import { cn } from "@/lib/utils";

const CANVAS_AGENTS = [
  { id: "email-crawler", label: "Email Crawler Pipeline", icon: Mail },
  { id: "lead-research-assistant", label: "Lead Research Assistant", icon: Search },
] as const;
type CanvasAgentId = (typeof CANVAS_AGENTS)[number]["id"];

function idleStatuses(): Record<AgentStage, StageStatus> {
  return AGENT_STAGES.reduce(
    (acc, s) => ((acc[s] = "idle"), acc),
    {} as Record<AgentStage, StageStatus>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function AgentCanvasWorkspace() {
  const [selected, setSelected] = React.useState<CanvasAgentId>("email-crawler");
  const [link, setLink] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [statuses, setStatuses] = React.useState<Record<AgentStage, StageStatus>>(idleStatuses);
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<{ emails?: string[]; raw?: string; error?: string } | null>(null);

  const setStatus = React.useCallback((stage: AgentStage, status: StageStatus) => {
    setStatuses((prev) => ({ ...prev, [stage]: status }));
  }, []);

  async function run() {
    if (running) return;
    if (!link.trim() && !details.trim()) return;
    setRunning(true);
    setResult(null);
    setStatuses(idleStatuses());
    const runId = `run-${Date.now()}`;
    emitRunStarted(runId);

    const req = fetch("/api/email-crawler", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ link: link.trim(), details: details.trim() }),
    });

    setStatus("input", "running");
    await wait(450);
    setStatus("input", "done");
    setStatus("browser", "running");
    await wait(750);
    setStatus("browser", "done");
    setStatus("captcha", "running");
    await wait(750);
    setStatus("captcha", "done");
    setStatus("crawl", "running");

    let data: any = null;
    try {
      const res = await req;
      data = await res.json().catch(() => ({}));
    } catch (e: any) {
      emitRunError(runId, String(e?.message ?? e));
      setStatus("crawl", "error");
      setResult({ error: "request failed" });
      setRunning(false);
      return;
    }

    setStatus("crawl", "done");
    setStatus("reacher", "running");
    await wait(500);
    setStatus("reacher", "done");

    const emails: string[] = Array.isArray(data?.emails) ? data.emails : [];
    setStatus("lead", emails.length ? "done" : "error");
    setResult({ emails, raw: data?.raw, error: data?.error });
    emitRunFinished(runId);
    setRunning(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        {CANVAS_AGENTS.map((agent) => {
          const Icon = agent.icon;
          const isSelected = selected === agent.id;
          return (
            <button
              key={agent.id}
              onClick={() => setSelected(agent.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors",
                isSelected
                  ? "border-[var(--text-accent)] bg-[var(--accent-wash)]"
                  : "border-rule bg-[var(--surface)] hover:bg-[var(--surface-2)]/60"
              )}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-sm",
                  isSelected ? "bg-[var(--surface)] text-[var(--text-accent)]" : "bg-[var(--surface-2)] text-ink-strong"
                )}
              >
                <Icon className="size-4" strokeWidth={1.5} />
              </span>
              <span className="font-body-tight text-sm text-ink-strong">{agent.label}</span>
            </button>
          );
        })}
      </div>

      {selected === "lead-research-assistant" ? (
        <div className="max-w-lg rounded-xl border bg-card/60 p-4">
          <h3 className="text-sm font-semibold">Lead Research Assistant</h3>
          <p className="mt-1 mb-4 text-xs text-muted-foreground">
            No required fields. Describe who to find, add one lead you have partial info on, or upload a CSV.
          </p>
          <LeadResearchAssistantPanel />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="rounded-xl border bg-card/60 p-4">
        <h3 className="text-sm font-semibold">Launch Pipeline</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Feed a prospect link or details. The canvas runs each pipeline stage and emits
          AG-UI events as it goes.
        </p>
        <label className="mt-4 block text-xs font-medium">Prospect link</label>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://youtube.com/@channel"
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <label className="mt-3 block text-xs font-medium">Prospect details</label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Company, domain, location"
          rows={3}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="mt-4">
          <ShimmerButton onClick={run} disabled={running}>
            {running ? "Running" : "Run Agent Pipeline"}
          </ShimmerButton>
        </div>

        {result && (
          <div className="mt-4 rounded-md border bg-background/60 p-3 text-xs">
            {result.error ? (
              <p className="text-rose-500">{result.error}</p>
            ) : (
              <>
                <p className="font-medium">Emails found: {result.emails?.length ?? 0}</p>
                {result.emails?.map((e) => (
                  <p key={e} className="text-emerald-500">{e}</p>
                ))}
                {!result.emails?.length && (
                  <p className="text-muted-foreground">No public email on visited pages.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div>
        <AgentFlowCanvas statuses={statuses} />
      </div>
      </div>
      )}
    </div>
  );
}
