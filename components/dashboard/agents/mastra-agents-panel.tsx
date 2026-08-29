import { Boxes } from "lucide-react";
import { PageHeader, Section, Surface, StatusBadge } from "@/components/system";
import { getMastraCatalog } from "@/lib/agents/mastra-catalog";
import { MastraAgentCard } from "./mastra-agent-card";

export async function MastraAgentsPanel() {
  const catalog = await getMastraCatalog();

  return (
    <Section tone="base">
      <PageHeader
        eyebrow="Self-hosted runtime"
        title="Mastra Agents"
        meta={
          catalog.online
            ? `${catalog.agents.length} agents live on your VPS`
            : "Persona catalog (Mastra server unreachable)"
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge tone={catalog.online ? "live" : "neutral"} dot label={catalog.online ? "Connected" : "Catalog"} />
        <span className="font-body text-xs text-ink-muted">
          These agents run on a separate, self-hosted Mastra process on your VPS (
          <code className="font-mono text-[11px]">agents.slideinventure.com</code>) — not inside this
          Next.js app. Click any agent for its capabilities, tools, and how to run it.
        </span>
      </div>

      <Surface variant="raised">
        {catalog.agents.length === 0 ? (
          <p className="font-body text-sm text-ink-muted py-4">
            No Mastra agents found. Start the Mastra server on the VPS to populate this list.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {catalog.agents.map((agent) => (
              <MastraAgentCard key={agent.slug} agent={agent} />
            ))}
          </div>
        )}
      </Surface>
    </Section>
  );
}
