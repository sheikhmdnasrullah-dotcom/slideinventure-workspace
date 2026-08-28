import { NextRequest } from "next/server";
import { RESEARCH_PERSONAS } from "@/lib/agents/research/personas";

// Public catalog of the three DeepSeek-powered research agents (emulating the
// requested GitHub frameworks) available for deployment.
export async function GET(_request: NextRequest) {
  const agents = RESEARCH_PERSONAS.map((p) => ({
    slug: p.slug,
    name: p.name,
    label: p.label,
    description: p.description,
    emoji: p.emoji,
    color: p.color,
    strategy: p.strategy,
  }));
  return Response.json({ agents });
}
