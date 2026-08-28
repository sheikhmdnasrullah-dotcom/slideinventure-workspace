import "server-only";
import { CONNECTABLE_TOOLKITS, type ConnectableToolkitSlug } from "@/lib/integrations/composio-toolkits";

// Composio: tool/action marketplace for agents (Tools & Connections section).
// Optional: only active when COMPOSIO_API_KEY is set. Degrades to no-op.
//
// Composio also publishes framework-specific "provider" packages (e.g.
// @composio/mastra) that pre-wrap tools for a given agent SDK. We don't use
// one: @composio/mastra's latest release (0.10.4) imports exports
// (omitNullToolArguments, toStrictJsonSchema) that no longer exist in our
// @composio/core (^0.17.0) — the two are out of sync upstream. Building the
// Mastra tools ourselves from the plain, version-stable tools.get() /
// tools.execute() + jsonSchemaToZodSchema() avoids that broken pairing.
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

// Cap per connected toolkit rather than exposing everything (Gmail alone has
// 60+ actions) — enough real actions for an agent to be useful without
// flooding a tool-calling model with more tools than it can reason about.
const TOOLS_PER_TOOLKIT_LIMIT = 15;

/**
 * Real, per-action Mastra tools (one per connected-integration action, e.g.
 * GMAIL_SEND_EMAIL — a proper typed schema, not a generic search/execute
 * pair) for every app actually connected in the Integrations section, never
 * the full unconnected marketplace. Empty object when Composio isn't
 * configured or nothing is connected yet — safe no-op.
 */
export async function getComposioSessionTools(): Promise<Record<string, unknown>> {
  const client = await getComposioClient();
  if (!client) return {};
  const connections = await listComposioConnections();
  const toolkits = Array.from(
    new Set(connections.filter((c) => c.status === "ACTIVE" || c.status === "active").map((c) => c.app.toLowerCase()))
  );
  if (!toolkits.length) return {};
  try {
    const [{ jsonSchemaToZodSchema }, { createTool }, { z }] = await Promise.all([
      import("@composio/core"),
      import("@mastra/core/tools"),
      import("zod"),
    ]);
    const raw = await client.tools.get(COMPOSIO_USER_ID, {
      toolkits,
      limit: TOOLS_PER_TOOLKIT_LIMIT * toolkits.length,
    });
    const list: any[] = Array.isArray(raw) ? raw : (raw?.items ?? []);

    const result: Record<string, unknown> = {};
    for (const t of list) {
      const slug = t?.slug ?? t?.name;
      if (!slug || typeof slug !== "string") continue;
      let inputSchema: any;
      try {
        inputSchema = t.inputParameters ? jsonSchemaToZodSchema(t.inputParameters) : z.object({});
      } catch {
        inputSchema = z.record(z.string(), z.unknown());
      }
      result[slug] = createTool({
        id: slug,
        description: t.description || `Execute the connected-integration action ${slug}.`,
        inputSchema,
        execute: async (args: unknown) => {
          try {
            const res = await client.tools.execute(slug, {
              userId: COMPOSIO_USER_ID,
              arguments: (args as Record<string, unknown>) ?? {},
              dangerouslySkipVersionCheck: true,
            });
            return JSON.stringify(res?.data ?? res ?? {});
          } catch (err) {
            return `error: ${err instanceof Error ? err.message : "Tool execution failed"}`;
          }
        },
      });
    }
    return result;
  } catch {
    return {};
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
