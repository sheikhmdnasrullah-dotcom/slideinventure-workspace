// Thin proxy to the main Next.js app's internal agent-tools endpoint for the
// handful of tools that need this app's own Appwrite data (retrieve, working
// memory, browse automation) — kept there instead of duplicated here so
// there's exactly one implementation of each. web_search and Composio tools
// don't go through this; they're self-contained and called directly.
const MAIN_APP_URL = process.env.MAIN_APP_URL ?? "https://slideinventure-work.vercel.app";
const SECRET = process.env.MASTRA_INTERNAL_SECRET;

export async function callInternalTool(action: string, payload: Record<string, unknown>): Promise<any> {
  if (!SECRET) throw new Error("MASTRA_INTERNAL_SECRET is not configured");
  const res = await fetch(`${MAIN_APP_URL}/api/internal/agent-tools`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) throw new Error(`internal tool "${action}" failed: ${res.status}`);
  return res.json();
}
