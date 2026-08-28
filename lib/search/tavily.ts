import "server-only";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilyOptions {
  maxResults?: number;
  searchDepth?: "basic" | "advanced";
}

/**
 * Server-side web search via Tavily. Returns [] on any failure (missing key,
 * network error, non-200) so callers can treat web results as a best-effort
 * augmentation rather than a hard dependency.
 */
export async function tavilySearch(
  query: string,
  opts: TavilyOptions = {}
): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !query.trim()) return [];

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: opts.maxResults ?? 5,
        search_depth: opts.searchDepth ?? "basic",
        include_answer: false,
      }),
      // Don't let a slow search stall the chat stream.
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`Tavily search failed: ${res.status}`);
      return [];
    }

    const data = (await res.json()) as { results?: any[] };
    return (data.results ?? []).map((r) => ({
      title: String(r.title ?? ""),
      url: String(r.url ?? ""),
      content: String(r.content ?? r.snippet ?? ""),
      score: Number(r.score ?? 0),
    }));
  } catch (err) {
    console.warn("Tavily search error (non-fatal):", err);
    return [];
  }
}
