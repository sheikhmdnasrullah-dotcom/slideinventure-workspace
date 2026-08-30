import { RESEARCH_PERSONAS } from "@/lib/agents/research/personas";
import { getAgentRoster } from "@/lib/agents/roster";
import { getMastraCatalog } from "@/lib/agents/mastra-catalog";

export type DeployableAgentCatalogItem = {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  strategy?: string;
  category: "research" | "outbound" | "crawler" | "knowledge" | "creative";
  runtime?: "mastra" | "claude";
};

export async function GET() {
  const researchItems: DeployableAgentCatalogItem[] = RESEARCH_PERSONAS.map((p) => ({
    slug: p.slug,
    name: p.name,
    emoji: p.emoji,
    color: p.color,
    description: p.description,
    strategy: p.strategy,
    category: "research",
  }));

  const roster = getAgentRoster();

  // Curate roster entries with vibrant colors and emojis
  const rosterItems: DeployableAgentCatalogItem[] = roster
    .filter((r) => !researchItems.some((ri) => ri.slug === r.slug))
    .map((r) => {
      let color = r.color || "#6366f1";
      let emoji = r.emoji || "🤖";
      let category: DeployableAgentCatalogItem["category"] = "knowledge";

      if (r.slug.includes("email") || r.slug.includes("outreach") || r.slug.includes("lead")) {
        category = "outbound";
        if (r.slug === "cold-outreach") {
          emoji = "📬";
          color = "#f59e0b";
        } else if (r.slug === "lead-qualifier") {
          emoji = "🎯";
          color = "#8b5cf6";
        } else if (r.slug === "lead-research-assistant") {
          emoji = "🧭";
          color = "#3b82f6";
        }
      } else if (r.slug.includes("crawler") || r.slug.includes("browse")) {
        category = "crawler";
        emoji = "🌐";
        color = "#14b8a6";
      } else if (r.slug.includes("brainstorm")) {
        category = "creative";
        emoji = "💡";
        color = "#eab308";
      } else if (r.slug.includes("knowledge")) {
        category = "knowledge";
        emoji = "📚";
        color = "#06b6d4";
      }

      return {
        slug: r.slug,
        name: r.name,
        emoji,
        color,
        description: r.description,
        category,
      };
    });

  const mastra = await getMastraCatalog();
  const taken = new Set([...researchItems, ...rosterItems].map((a) => a.slug));
  const mastraItems: DeployableAgentCatalogItem[] = mastra.agents
    .filter((a) => !taken.has(a.slug))
    .map((a) => {
      const tools = a.tools ?? [];
      let category: DeployableAgentCatalogItem["category"] = "knowledge";
      if (tools.some((t) => /(search|web|browser|browse|research|tavily|crawl)/i.test(t))) category = "research";
      else if (tools.some((t) => /(email|send|outbound|lead)/i.test(t))) category = "outbound";
      else if (tools.some((t) => /(crawl|scrape)/i.test(t))) category = "crawler";
      return {
        slug: a.slug,
        name: a.name,
        emoji: a.emoji || "🛰️",
        color: a.color || "#22d3ee",
        description: a.description,
        category,
        runtime: "mastra",
      };
    });

  const agents = [...researchItems, ...rosterItems, ...mastraItems];
  return Response.json({ agents });
}
