import "server-only";

// Infisical. Secrets management. Optional: when INFISICAL_TOKEN (+ project) is
// set, load secrets into process.env at boot (see lib/vault/infisical-load.ts,
// invoked from the server bootstrap). Degrades to no-op otherwise.
export function infisicalEnabled(): boolean {
  return Boolean(process.env.INFISICAL_TOKEN && process.env.INFISICAL_PROJECT_ID);
}

export async function loadInfisicalSecrets(): Promise<void> {
  if (!infisicalEnabled()) return;
  try {
    const infisicalModule = (await import("@infisical/sdk")) as any;
    const ClientClass = infisicalModule.InfisicalClient || infisicalModule.InfisicalSDK;
    if (!ClientClass) return;
    const client = new ClientClass({
      token: process.env.INFISICAL_TOKEN as string,
    });
    const secrets = await client.listSecrets({
      environment: process.env.INFISICAL_ENV || "production",
      projectId: process.env.INFISICAL_PROJECT_ID as string,
    });
    for (const s of (secrets as any[]) || []) {
      if (s.key && process.env[s.key] === undefined) {
        process.env[s.key] = s.value;
      }
    }
  } catch {
    /* best-effort */
  }
}
