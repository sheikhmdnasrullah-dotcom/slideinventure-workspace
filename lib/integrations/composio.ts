import "server-only";

// Composio: tool/action marketplace for agents (Tools & Connections section).
// Optional: only active when COMPOSIO_API_KEY is set. Degrades to no-op.
export function composioEnabled(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY);
}

export async function getComposioClient(): Promise<any | null> {
  if (!composioEnabled()) return null;
  try {
    const { Composio } = await import("@composio/core");
    return new Composio({ apiKey: process.env.COMPOSIO_API_KEY as string });
  } catch {
    return null;
  }
}

export async function listComposioConnections(): Promise<
  { id: string; app: string; status: string }[]
> {
  const client = await getComposioClient();
  if (!client) return [];
  try {
    const res = await client.connectedAccounts.list();
    return (res.items ?? res ?? []).map((a: any) => ({
      id: a.id,
      app: a.appName || a.app,
      status: a.status,
    }));
  } catch {
    return [];
  }
}

// Single tenant workspace: every Composio connected account belongs to this
// one user, so there is no per-user id to thread through. "default" is the
// user id Composio's SDK requires as a parameter, not a real account.
const COMPOSIO_USER_ID = "default";

export type ComposioToolInfo = { slug: string; name: string; description: string };

/**
 * Finds executable actions from apps actually connected in the Integrations
 * section (never the full, unconnected marketplace) so an agent only ever
 * discovers tools it's authorized to run.
 */
export async function findComposioTools(query: string, limit = 10): Promise<ComposioToolInfo[]> {
  const client = await getComposioClient();
  if (!client) return [];
  const connections = await listComposioConnections();
  const toolkits = Array.from(
    new Set(connections.filter((c) => c.status === "ACTIVE" || c.status === "active").map((c) => c.app.toLowerCase()))
  );
  if (!toolkits.length) return [];
  try {
    const tools = await client.tools.get(COMPOSIO_USER_ID, {
      toolkits,
      search: query || undefined,
      limit,
    });
    const list = Array.isArray(tools) ? tools : (tools?.items ?? []);
    return list.map((t: any) => ({
      slug: t.slug ?? t.name,
      name: t.name ?? t.slug,
      description: t.description ?? "",
    }));
  } catch {
    return [];
  }
}

/**
 * Executes one connected-integration action by its tool slug (from
 * findComposioTools). This is real side-effecting execution — sending an
 * email, creating a calendar event, posting a message — scoped to whatever
 * apps the user has connected in Integrations.
 */
export async function executeComposioTool(
  slug: string,
  args: Record<string, unknown>
): Promise<{ ok: boolean; result: string }> {
  const client = await getComposioClient();
  if (!client) return { ok: false, result: "Composio is not configured." };
  try {
    const res = await client.tools.execute(slug, {
      userId: COMPOSIO_USER_ID,
      arguments: args,
      dangerouslySkipVersionCheck: true,
    });
    return { ok: true, result: JSON.stringify(res?.data ?? res ?? {}) };
  } catch (err) {
    return { ok: false, result: err instanceof Error ? err.message : "Tool execution failed" };
  }
}
