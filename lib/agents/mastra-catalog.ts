import "server-only";

export type MastraCatalogAgent = {
  slug: string;
  name: string;
  description: string;
  instructions: string;
  tools: string[];
  provider: string;
  modelId: string;
  modelVersion: string | null;
  supportsMemory: boolean;
  source: string;
  division: string;
  emoji: string | null;
  color: string | null;
  online: boolean;
};

export type MastraCatalog = {
  online: boolean;
  baseUrl: string | null;
  agents: MastraCatalogAgent[];
};

function fromRoster(roster: { slug: string; name: string; description: string; division: string; emoji: string | null; color: string | null }[]): MastraCatalogAgent[] {
  return roster.map((r) => ({
    slug: r.slug,
    name: r.name,
    description: r.description,
    instructions: "",
    tools: [],
    provider: "",
    modelId: "",
    modelVersion: null,
    supportsMemory: false,
    source: "persona",
    division: r.division,
    emoji: r.emoji,
    color: r.color ?? "#22d3ee",
    online: false,
  }));
}

/**
 * Lists the agents running on the self-hosted Mastra server (VPS). Tries the
 * live server first; if it's unreachable or unconfigured, falls back to the
 * file-based persona roster so the "Mastra Agents" section always renders
 * with the catalog. `online` tells the UI whether the data is live.
 */
export async function getMastraCatalog(): Promise<MastraCatalog> {
  const { getAgentRoster } = await import("./roster");
  const roster = getAgentRoster();
  const rosterBySlug = new Map(roster.map((r) => [r.slug, r]));
  const baseUrl = process.env.MASTRA_SERVER_URL;
  const secret = process.env.MASTRA_INTERNAL_SECRET;

  if (!baseUrl) {
    return { online: false, baseUrl: null, agents: fromRoster(roster) };
  }

  try {
    const res = await fetch(`${baseUrl}/api/agents`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      next: { revalidate: 60 },
    });
    if (!res.ok) return { online: false, baseUrl, agents: fromRoster(roster) };
    const json = await res.json();
    const list = (json.agents ?? json) as Record<string, any>;
    const agents: MastraCatalogAgent[] = Object.values(list).map((a: any) => {
      const slug = String(a.name ?? a.id);
      const r = rosterBySlug.get(slug);
      const rawTools = a.tools;
      const tools: string[] = Array.isArray(rawTools)
        ? rawTools.map((t: any) => (typeof t === "string" ? t : t?.id ?? t?.name)).filter(Boolean)
        : rawTools && typeof rawTools === "object"
          ? Object.keys(rawTools)
          : [];
      return {
        slug,
        name: slug,
        description: typeof a.description === "string" ? a.description : "",
        instructions: typeof a.instructions === "string" ? a.instructions : "",
        tools,
        provider: a.provider ?? "",
        modelId: a.modelId ?? "",
        modelVersion: a.modelVersion ?? null,
        supportsMemory: Boolean(a.supportsMemory),
        source: a.source ?? "mastra",
        division: r?.division ?? "Mastra",
        emoji: r?.emoji ?? null,
        color: r?.color ?? "#22d3ee",
        online: true,
      };
    });
    agents.sort((x, y) => x.name.localeCompare(y.name));
    return { online: true, baseUrl, agents };
  } catch {
    return { online: false, baseUrl, agents: fromRoster(roster) };
  }
}
