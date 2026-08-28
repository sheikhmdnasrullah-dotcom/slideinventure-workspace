import "server-only";
import { CONNECTABLE_TOOLKITS, type ConnectableToolkitSlug } from "@/lib/integrations/composio-toolkits";

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
 * Starts a Composio-managed OAuth connection for one of the curated
 * connectable toolkits: reuses an existing auth config for that toolkit if
 * one exists, otherwise creates a Composio-managed one (no OAuth app
 * credentials of our own required), then returns the redirect URL the
 * browser opens to complete the provider's consent screen. Composio handles
 * the callback itself; connectedAccounts then shows up via
 * listComposioConnections() once the user finishes.
 */
export async function initiateComposioConnection(
  toolkit: ConnectableToolkitSlug,
  callbackUrl?: string
): Promise<{ redirectUrl: string } | { error: string }> {
  if (!CONNECTABLE_TOOLKITS.some((t) => t.slug === toolkit)) {
    return { error: "Unknown app." };
  }
  const client = await getComposioClient();
  if (!client) return { error: "Composio is not configured." };
  try {
    const existing = await client.authConfigs.list({ toolkit });
    const existingItems = existing?.items ?? existing ?? [];
    let authConfigId: string | undefined = existingItems[0]?.id ?? existingItems[0]?.nanoid;

    if (!authConfigId) {
      const created = await client.authConfigs.create(toolkit, {
        type: "use_composio_managed_auth",
        name: `${toolkit} (workspace-app)`,
      });
      authConfigId = created?.id ?? created?.authConfigId ?? created?.nanoid;
    }
    if (!authConfigId) return { error: "Could not set up this integration." };

    const connectionRequest = await client.connectedAccounts.link(
      COMPOSIO_USER_ID,
      authConfigId,
      callbackUrl ? { callbackUrl } : undefined
    );
    const redirectUrl = connectionRequest?.redirectUrl ?? connectionRequest?.redirect_url;
    if (!redirectUrl) return { error: "Could not start the connection." };
    return { redirectUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not connect this app." };
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
