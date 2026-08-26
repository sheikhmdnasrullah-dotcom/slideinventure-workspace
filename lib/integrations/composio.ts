import "server-only";

// Composio — tool/action marketplace for agents (Tools & Connections section).
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
