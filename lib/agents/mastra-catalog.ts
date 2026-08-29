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

type Json = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Lists the agents running on the self-hosted Mastra server (VPS). If the
 * server is unreachable or unconfigured, returns an empty list with
 * `online: false` — the "Mastra Agents" tab then shows a clear offline state
 * instead of mixing in the Claude personas from the roster.
 */
export async function getMastraCatalog(): Promise<MastraCatalog> {
  const { getAgentRoster } = await import("./roster");
  const roster = getAgentRoster();
  const rosterBySlug = new Map(roster.map((r) => [r.slug, r]));
  const baseUrl = process.env.MASTRA_SERVER_URL;
  const secret = process.env.MASTRA_INTERNAL_SECRET;

  if (!baseUrl) {
    return { online: false, baseUrl: null, agents: [] };
  }

  try {
    const res = await fetch(`${baseUrl}/api/agents`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      next: { revalidate: 60 },
    });
    if (!res.ok) return { online: false, baseUrl, agents: [] };

    const json = (await res.json()) as Json;
    const maybeAgents = json.agents;
    const list = maybeAgents && typeof maybeAgents === "object" ? (maybeAgents as Json) : json;

    const agents: MastraCatalogAgent[] = Object.values(list).map((a) => {
      const x = a as Json;
      const slug = str(x.name) || str(x.id);
      const r = rosterBySlug.get(slug);
      const rawTools = x.tools;
      let tools: string[] = [];
      if (Array.isArray(rawTools)) {
        tools = rawTools
          .map((t) => (typeof t === "string" ? t : str((t as Json)?.id || (t as Json)?.name)))
          .filter(Boolean);
      } else if (rawTools && typeof rawTools === "object") {
        tools = Object.keys(rawTools as Json);
      }
      return {
        slug,
        name: slug,
        description: str(x.description),
        instructions: str(x.instructions),
        tools,
        provider: str(x.provider),
        modelId: str(x.modelId),
        modelVersion: typeof x.modelVersion === "string" ? x.modelVersion : null,
        supportsMemory: Boolean(x.supportsMemory),
        source: str(x.source) || "mastra",
        division: r?.division ?? "Mastra",
        emoji: r?.emoji ?? null,
        color: r?.color ?? "#22d3ee",
        online: true,
      };
    });
    agents.sort((m, n) => m.name.localeCompare(n.name));
    return { online: true, baseUrl, agents };
  } catch {
    return { online: false, baseUrl, agents: [] };
  }
}
