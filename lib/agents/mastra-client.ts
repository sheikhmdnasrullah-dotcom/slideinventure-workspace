import "server-only";

export type MastraAgentResult = {
  ok: boolean;
  answer: string;
  agentName: string;
  toolCalls?: string[];
  error?: string;
};

/**
 * Thin HTTP client for the self-hosted Mastra AI server (VPS,
 * agents.slideinventure.com) — replaces the old in-process `runMastraAgent`
 * from lib/agents/mastra.ts. Agent execution (personas + tools: web search,
 * retrieve, browse, memory, connected integrations) now happens entirely on
 * that separate long-lived process; this app only dispatches the request and
 * writes down the result, same shape as before so both call sites
 * (app/api/agents/chat/route.ts, lib/agents/worker.ts) barely change.
 */
export async function runMastraAgent(opts: {
  slug: string;
  message: string;
  history?: Array<{ role: string; content: string }>;
  userEmail: string;
}): Promise<MastraAgentResult> {
  const baseUrl = process.env.MASTRA_SERVER_URL;
  const secret = process.env.MASTRA_INTERNAL_SECRET;
  if (!baseUrl) {
    return { ok: false, answer: "", agentName: opts.slug, error: "MASTRA_SERVER_URL is not configured" };
  }

  const messages = [
    ...(opts.history ?? [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: opts.message },
  ];

  try {
    const res = await fetch(`${baseUrl}/api/agents/${encodeURIComponent(opts.slug)}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({
        messages,
        requestContext: { userEmail: opts.userEmail },
      }),
    });

    if (res.status === 404) {
      return { ok: false, answer: "", agentName: opts.slug, error: "Unknown agent" };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, answer: "", agentName: opts.slug, error: text || `Agent server returned ${res.status}` };
    }

    const json = await res.json();
    const toolCalls: string[] = Array.isArray(json.toolCalls)
      ? json.toolCalls.map((t: any) => t.payload?.toolName ?? t.toolName).filter(Boolean)
      : [];

    return { ok: true, answer: json.text ?? "", agentName: opts.slug, toolCalls };
  } catch (err) {
    return {
      ok: false,
      answer: "",
      agentName: opts.slug,
      error: err instanceof Error ? err.message : "Could not reach the agent server",
    };
  }
}
