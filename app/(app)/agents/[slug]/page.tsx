import { notFound } from "next/navigation";
import { getAgentPrompt, getAgentRoster } from "@/lib/agents/roster";
import { AgentWorkflowCanvas } from "@/components/dashboard/agent-workflow-canvas";
import { AgentIcon } from "@/components/dashboard/agent-icon";
import Link from "next/link";

export function generateStaticParams() {
  return getAgentRoster().filter((a) => a.slug !== "youtube-email").map((a) => ({ slug: a.slug }));
}

export default async function AgentCanvasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = getAgentRoster().find((a) => a.slug === slug);
  const agent = getAgentPrompt(slug);
  if (!meta || !agent) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-rule px-6 py-4">
        <Link
          href="/agents"
          className="rounded-md border border-rule px-2 py-1 text-xs text-ink-muted hover:text-ink-strong"
        >
          ← Agents
        </Link>
        <span
          className="flex size-9 items-center justify-center rounded-lg text-ink-strong"
          style={{
            background: `color-mix(in oklch, ${meta.color || "#6366f1"} 16%, transparent)`,
          }}
        >
          <AgentIcon slug={meta.slug} className="size-5" />
        </span>
        <div>
          <h1 className="font-label text-sm font-semibold text-ink-strong">{meta.name}</h1>
          <p className="text-xs text-ink-muted">{meta.division}</p>
        </div>
      </div>
      <AgentWorkflowCanvas
        slug={meta.slug}
        name={meta.name}
        persona={agent.prompt}
      />
    </div>
  );
}
