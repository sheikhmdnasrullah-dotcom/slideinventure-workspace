import "server-only";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

export type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
};

export type TavilySearchResponse = {
  query: string;
  results: TavilyResult[];
  answer?: string;
};

export async function searchTavily(
  query: string,
  options: {
    maxResults?: number;
    searchDepth?: "basic" | "advanced";
    includeAnswer?: boolean;
  } = {}
): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  const body = {
    api_key: apiKey,
    query,
    max_results: options.maxResults ?? 5,
    search_depth: options.searchDepth ?? "basic",
    include_answer: options.includeAnswer ?? false,
  };

  const res = await fetch(TAVILY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tavily search failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    results?: TavilyResult[];
    answer?: string;
  };

  return {
    query,
    results: data.results ?? [],
    answer: data.answer,
  };
}

export function buildLeadResearchQuery(lead: {
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  position?: string;
}): string {
  const parts: string[] = [];
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
  if (name) parts.push(name);
  if (lead.company) parts.push(lead.company);
  if (lead.position) parts.push(lead.position);
  if (lead.email) {
    const domain = lead.email.split("@")[1];
    if (domain && !parts.some((p) => p.includes(domain))) {
      parts.push(domain);
    }
  }
  return parts.join(" ");
}
