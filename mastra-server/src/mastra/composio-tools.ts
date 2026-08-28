// Direct port of getComposioSessionTools() from the main app's
// lib/integrations/composio.ts. This one is self-contained (only talks to
// Composio's own API, never this app's Appwrite), so it runs natively here
// rather than proxying back — same rationale as web_search.
const COMPOSIO_USER_ID = "default";
const TOOLS_PER_TOOLKIT_LIMIT = 15;

function composioEnabled(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY);
}

async function getComposioClient(): Promise<any | null> {
  if (!composioEnabled()) return null;
  try {
    const { Composio } = await import("@composio/core");
    return new Composio({ apiKey: process.env.COMPOSIO_API_KEY as string });
  } catch {
    return null;
  }
}

async function listComposioConnections(): Promise<{ id: string; app: string; status: string }[]> {
  const client = await getComposioClient();
  if (!client) return [];
  try {
    const res = await client.connectedAccounts.list();
    return (res.items ?? res ?? []).map((a: any) => ({ id: a.id, app: a.appName || a.app, status: a.status }));
  } catch {
    return [];
  }
}

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

export async function getIntegrationsListTool() {
  const { createTool } = await import("@mastra/core/tools");
  const { z } = await import("zod");
  return createTool({
    id: "integrations",
    description:
      "List the external tools and integrations connected to this workspace (e.g. Composio apps). Use to discover what external actions are available before reasoning about a task.",
    inputSchema: z.object({}),
    execute: async () => {
      const connections = await listComposioConnections();
      if (!connections.length) return "No external integrations are connected.";
      return connections.map((c) => `- ${c.app} (${c.status})`).join("\n");
    },
  });
}
