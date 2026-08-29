"use client";

import { useState } from "react";
import { AgentModesGrid } from "./agent-modes-grid";
import { AgentCard } from "./agent-card";
import { normalizeClaude, normalizeMastra } from "@/lib/agents/pipeline";
import type { MastraCatalogAgent } from "@/lib/agents/mastra-catalog";
import type { RosterAgent } from "@/lib/agents/roster";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "mode", label: "Agents Mode" },
  { id: "mastra", label: "Mastra Agents" },
  { id: "claude", label: "Claude Agents" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AgentsTabs({
  mastraAgents,
  claudeAgents,
}: {
  mastraAgents: MastraCatalogAgent[];
  claudeAgents: RosterAgent[];
}) {
  const [tab, setTab] = useState<TabId>("mode");
  const mastra = mastraAgents.map(normalizeMastra);
  const claude = claudeAgents.map(normalizeClaude);

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-rule">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-2 font-label text-sm transition-colors",
              tab === t.id
                ? "border-b-2 border-[var(--text-accent)] text-ink-strong"
                : "text-ink-muted hover:text-ink-strong"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "mode" && <AgentModesGrid />}

        {tab === "mastra" &&
          (mastra.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {mastra.map((a) => (
                <AgentCard key={a.slug} agent={a} />
              ))}
            </div>
          ) : (
            <p className="font-body text-sm text-ink-muted py-4">
              Mastra server is offline. Start it on the VPS to list these agents.
            </p>
          ))}

        {tab === "claude" &&
          (claude.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {claude.map((a) => (
                <AgentCard key={a.slug} agent={a} />
              ))}
            </div>
          ) : (
            <p className="font-body text-sm text-ink-muted py-4">No personas configured.</p>
          ))}
      </div>
    </div>
  );
}
