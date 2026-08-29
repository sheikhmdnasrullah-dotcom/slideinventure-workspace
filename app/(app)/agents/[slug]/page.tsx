import { notFound } from "next/navigation";
import Link from "next/link";
import { getAgentRoster, getAgentPrompt } from "@/lib/agents/roster";
import { getMastraCatalog } from "@/lib/agents/mastra-catalog";
import { AgentWorkflowCanvas } from "@/components/dashboard/agent-workflow-canvas";
import { MastraAgentPlayground } from "@/components/dashboard/agents/mastra-agent-playground";
import { agentIcon, normalizeClaude, normalizeMastra } from "@/lib/agents/pipeline";
import { StatusBadge } from "@/components/system";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const catalog = await getMastraCatalog();
  const mastra = catalog.agents.find((a) => a.slug === slug);

  if (mastra) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-rule px-6 py-4">
          <Link
            href="/agents"
            className="rounded-md border border-rule px-2 py-1 text-xs text-ink-muted hover:text-ink-strong"
          >
            ← Agents
          </Link>
          <span
            className="flex size-9 items-center justify-center rounded-lg text-ink-strong"
            style={{ background: `color-mix(in oklch, ${mastra.color || "#22d3ee"} 16%, transparent)` }}
          >
            {agentIcon(normalizeMastra(mastra), "size-5")}
          </span>
          <div>
            <h1 className="font-label text-sm font-semibold text-ink-strong">{mastra.name}</h1>
            <p className="text-xs text-ink-muted">{mastra.description || "Mastra agent"}</p>
          </div>
          <div className="ml-auto">
            <StatusBadge tone="live" label="Mastra · VPS" />
          </div>
        </header>
        <MastraAgentPlayground agent={mastra} />
      </div>
    );
  }

  const meta = getAgentRoster().find((a) => a.slug === slug);
  const agent = getAgentPrompt(slug);
  if (!meta || !agent) notFound();

  const normalized = normalizeClaude(meta);
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-rule px-6 py-4">
        <Link
          href="/agents"
          className="rounded-md border border-rule px-2 py-1 text-xs text-ink-muted hover:text-ink-strong"
        >
          ← Agents
        </Link>
        <span
          className="flex size-9 items-center justify-center rounded-lg text-ink-strong"
          style={{ background: `color-mix(in oklch, ${meta.color || "#6366f1"} 16%, transparent)` }}
        >
          {agentIcon(normalized, "size-5")}
        </span>
        <div>
          <h1 className="font-label text-sm font-semibold text-ink-strong">{meta.name}</h1>
          <p className="text-xs text-ink-muted">{meta.division}</p>
        </div>
        <div className="ml-auto">
          <StatusBadge tone="info" label="Claude" />
        </div>
      </header>
      <AgentWorkflowCanvas slug={meta.slug} name={meta.name} persona={agent.prompt} />
    </div>
  );
}
