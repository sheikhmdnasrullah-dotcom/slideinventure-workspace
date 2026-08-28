import "server-only";
import { databases, ID, Query } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";

// Durable, server-side queue for agent runs. Jobs live in Appwrite (Postgres
// behind Appwrite) so they survive the browser closing, a serverless function
// recycling, or the user's machine being turned off. The worker (run via
// waitUntil on enqueue, or lazily by the poll endpoint) executes the agent and
// writes the answer back here.
const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.agentJobs;

export type AgentJobStatus = "pending" | "running" | "done" | "error";

export type AgentJobInput = {
  slug: string;
  owner: string;
  message: string;
  history: Array<{ role: string; content: string }>;
  tools: boolean;
};

export type AgentJob = {
  id: string;
  slug: string;
  owner: string;
  status: AgentJobStatus;
  message: string;
  history: Array<{ role: string; content: string }>;
  tools: boolean;
  answer: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

let ensured: Promise<void> | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForCollection(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await databases.getCollection(DB, COL);
      return;
    } catch {
      // still provisioning
    }
    await sleep(1500);
  }
}

async function waitForAttributes(timeoutMs = 40_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const attrs = await databases.listAttributes(DB, COL);
      const keys = new Set((attrs.attributes ?? []).map((a: any) => a.key));
      if (
        keys.has("status") &&
        keys.has("owner") &&
        keys.has("slug") &&
        keys.has("payload") &&
        keys.has("answer") &&
        keys.has("error")
      ) {
        return;
      }
    } catch {
      // collection may still be provisioning
    }
    await sleep(1500);
  }
}

export function ensureAgentJobsCollection(): Promise<void> {
  if (ensured) return ensured;
  ensured = (async () => {
    try {
      try {
        await databases.getCollection(DB, COL);
        return;
      } catch {
        // not present yet
      }
      try {
        await databases.createCollection(DB, COL, "Agent Jobs");
      } catch (e: any) {
        if (!/already exists|exists/i.test(String(e?.message))) throw e;
      }
      // Appwrite provisions the collection asynchronously; wait before adding attrs.
      await waitForCollection();
      const str = async (key: string, size: number, required: boolean) => {
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            await databases.createStringAttribute(DB, COL, key, size, required);
            return;
          } catch (e: any) {
            if (/already exists|exists/i.test(String(e?.message))) return;
            await sleep(1000);
          }
        }
        console.error("failed to create attribute", key);
      };
      await str("status", 32, true);
      await str("owner", 200, true);
      await str("slug", 100, true);
      await str("payload", 65000, true);
      await str("answer", 65000, false);
      await str("error", 4000, false);
      await waitForAttributes();
    } catch (e) {
      ensured = null; // allow a later retry
      throw e;
    }
  })();
  return ensured;
}

function serialize(doc: any): AgentJob {
  let payload: any = {};
  try {
    payload = JSON.parse(doc.payload ?? "{}");
  } catch {
    payload = {};
  }
  return {
    id: doc.$id,
    slug: doc.slug,
    owner: doc.owner,
    status: doc.status,
    message: payload.message ?? "",
    history: payload.history ?? [],
    tools: Boolean(payload.tools),
    answer: doc.answer || null,
    error: doc.error || null,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

export async function enqueueAgentJob(input: AgentJobInput): Promise<AgentJob> {
  await ensureAgentJobsCollection();
  const now = new Date().toISOString();
  const doc = await databases.createDocument(DB, COL, ID.unique(), {
    status: "pending",
    owner: input.owner,
    slug: input.slug,
    payload: JSON.stringify({
      message: input.message,
      history: input.history,
      tools: input.tools,
    }),
    answer: "",
    error: "",
    created_at: now,
    updated_at: now,
  });
  return serialize(doc);
}

export async function getAgentJobById(id: string): Promise<AgentJob | null> {
  try {
    const doc = await databases.getDocument(DB, COL, id);
    return serialize(doc);
  } catch {
    return null;
  }
}

export async function getAgentJob(id: string, owner: string): Promise<AgentJob | null> {
  const job = await getAgentJobById(id);
  if (!job || job.owner !== owner) return null;
  return job;
}

export async function listPendingAgentJobs(limit = 50): Promise<AgentJob[]> {
  try {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal("status", "pending"),
      Query.orderAsc("created_at"),
      Query.limit(limit),
    ]);
    return res.documents.map(serialize);
  } catch {
    return [];
  }
}

export async function updateAgentJob(
  id: string,
  patch: Partial<{ status: AgentJobStatus; answer: string; error: string }>
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.answer !== undefined) payload.answer = patch.answer;
  if (patch.error !== undefined) payload.error = patch.error;
  try {
    await databases.updateDocument(DB, COL, id, payload);
  } catch (e) {
    console.error("updateAgentJob failed", id, e);
  }
}
