"use client";

import * as React from "react";
import Link from "next/link";
import { Info, Boxes, Wrench, MemoryStick } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import type { MastraCatalogAgent } from "@/lib/agents/mastra-catalog";

function tint(hex: string | null) {
  const c = hex || "#22d3ee";
  return {
    bg: `color-mix(in oklch, ${c} 14%, transparent)`,
    ring: `color-mix(in oklch, ${c} 45%, transparent)`,
  };
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[var(--surface-2)] px-3 py-2">
      <div className="font-label text-[10px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-0.5 font-body text-xs text-ink-strong">{value}</div>
    </div>
  );
}

export function MastraAgentCard({ agent }: { agent: MastraCatalogAgent }) {
  const [open, setOpen] = React.useState(false);
  const t = tint(agent.color);
  const model = [agent.provider, agent.modelId].filter(Boolean).join(" / ") || "DeepSeek";
  const capability =
    agent.description?.trim() ||
    agent.instructions?.slice(0, 180).trim() ||
    "General-purpose Mastra agent.";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex h-full flex-col items-start gap-3 rounded-xl border border-rule bg-[var(--surface)] p-4 text-left transition-all duration-base ease-std hover:-translate-y-0.5 hover:border-[var(--text-accent)] hover:shadow-[var(--shadow-float)]"
      >
        <div className="flex w-full items-center justify-between">
          <span
            className="flex size-11 items-center justify-center rounded-xl text-ink-strong"
            style={{ background: t.bg, boxShadow: `inset 0 0 0 1px ${t.ring}` }}
          >
            <Boxes className="size-5" />
          </span>
          <span
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide"
            style={{ background: t.bg, color: agent.color || "var(--text-accent)" }}
          >
            <Boxes className="size-3" /> Mastra
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="font-label text-sm font-semibold text-ink-strong leading-tight">{agent.name}</h3>
          <p className="mt-1 text-xs text-ink-muted leading-relaxed line-clamp-3">{capability}</p>
        </div>
        <div className="mt-auto flex w-full items-center gap-2 text-[11px] text-ink-muted">
          <Wrench className="size-3" /> {agent.tools.length} tools
          {agent.supportsMemory && (
            <>
              <MemoryStick className="size-3 ml-1" /> memory
            </>
          )}
          <Info className="size-3 ml-auto opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-border/60">
            <div className="flex items-center gap-3">
              <span
                className="flex size-10 items-center justify-center rounded-xl"
                style={{ background: t.bg, color: agent.color || "var(--text-accent)" }}
              >
                <Boxes className="size-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-semibold tracking-tight">{agent.name}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide"
                    style={{ background: t.bg, color: agent.color || "var(--text-accent)" }}
                  >
                    Mastra Agent
                  </span>{" "}
                  {agent.division}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label="Framework" value="Mastra (self-hosted)" />
              <Field label="Host" value="VPS · agents.slideinventure.com" />
              <Field label="Model" value={model} />
              <Field label="Status" value={agent.online ? "Online · live" : "Catalog (server offline)"} />
              <Field label="Memory" value={agent.supportsMemory ? "Enabled" : "Disabled"} />
              <Field label="Defined in" value={agent.source} />
            </div>

            <div>
              <h4 className="font-label text-xs uppercase tracking-wide text-ink-muted mb-1.5">
                What this agent does
              </h4>
              <p className="text-sm text-ink-strong whitespace-pre-wrap leading-relaxed">
                {agent.description?.trim() ||
                  agent.instructions?.slice(0, 800)?.trim() ||
                  "General-purpose Mastra agent."}
              </p>
            </div>

            <div>
              <h4 className="font-label text-xs uppercase tracking-wide text-ink-muted mb-1.5">
                Tools ({agent.tools.length})
              </h4>
              {agent.tools.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {agent.tools.slice(0, 16).map((tool) => (
                    <span
                      key={tool}
                      className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-[11px] text-ink-muted font-mono"
                    >
                      {tool}
                    </span>
                  ))}
                  {agent.tools.length > 16 && (
                    <span className="rounded-md px-2 py-1 text-[11px] text-ink-faint">
                      +{agent.tools.length - 16} more
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-ink-muted">No tools reported (server offline).</p>
              )}
            </div>

            <div>
              <h4 className="font-label text-xs uppercase tracking-wide text-ink-muted mb-1.5">
                How to make it work
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-ink-strong">
                <li>
                  Open the agent canvas or chat and select the <b>{agent.name}</b> persona.
                </li>
                <li>
                  Send a message — the agent runs live on your VPS Mastra server (always on, no
                  setup needed).
                </li>
                <li>
                  Or call the Agent API directly:{" "}
                  <code className="font-mono text-xs bg-[var(--surface-2)] px-1 py-0.5 rounded">
                    POST /api/agents/{agent.slug}/generate
                  </code>{" "}
                  on the Mastra server.
                </li>
                <li>
                  It uses its tools (web search, retrieve, memory, connected integrations)
                  autonomously to answer.
                </li>
              </ol>
              <p className="mt-2 text-xs text-ink-muted">
                Model: {model}.
                {agent.supportsMemory
                  ? " Remembers context across turns via working memory."
                  : ""}{" "}
                These agents live outside this Next.js app — they are a separate self-hosted
                Mastra process, which is why they stay available even if the dashboard restarts.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Link
                href={`/agents/${agent.slug}`}
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                Open agent
              </Link>
              <button
                onClick={() => setOpen(false)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Close
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
