import "server-only";

// Mem0 — managed memory layer. Optional: when MEM0_API_KEY is set, the agent's
// remember/recall tools use Mem0 instead of (or in addition to) working_memory.
export function mem0Enabled(): boolean {
  return Boolean(process.env.MEM0_API_KEY);
}

export async function mem0Client(): Promise<any | null> {
  if (!mem0Enabled()) return null;
  try {
    const { MemoryClient } = await import("mem0ai");
    return new MemoryClient({ apiKey: process.env.MEM0_API_KEY as string });
  } catch {
    return null;
  }
}

export async function mem0Remember(userEmail: string, content: string): Promise<void> {
  const client = await mem0Client();
  if (!client) return;
  try {
    await client.add([{ role: "user", content }], { user_id: userEmail });
  } catch {
    /* no-op */
  }
}

export async function mem0Recall(userEmail: string, query: string): Promise<string> {
  const client = await mem0Client();
  if (!client) return "";
  try {
    const res = await client.search(query, { user_id: userEmail });
    return (Array.isArray(res) ? res : []).map((m: any) => `- ${m.memory || m.text || ""}`).join("\n");
  } catch {
    return "";
  }
}
