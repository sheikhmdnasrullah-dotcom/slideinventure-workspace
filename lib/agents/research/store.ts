import "server-only";
import { databases, ID, Query } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";

// Durable store for multi-agent research sessions. One session = one research
// task being discussed round-robin by 2-3 research agents. Persisted in
// Appwrite so the discussion survives navigations, reloads, and runs in the
// background (see orchestrator.ts).
const DB = APPWRITE.databaseId;
const COL = "research_sessions";

export type ResearchTurn = {
  agentSlug: string;
  agentLabel: string;
  text: string;
  tick: number;
};

export type ResearchAgentRef = { slug: string; label: string };

export type ResearchStatus = "pending" | "running" | "done" | "error";

export type ResearchSession = {
  id: string;
  status: ResearchStatus;
  owner: string;
  task: string;
  agents: ResearchAgentRef[];
  turns: ResearchTurn[];
  conclusion: string | null;
  noteId: string | null;
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
      await sleep(1500);
    }
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
        keys.has("task") &&
        keys.has("agents") &&
        keys.has("turns") &&
        keys.has("conclusion") &&
        keys.has("noteId")
      ) {
        return;
      }
    } catch {
      // still provisioning
    }
    await sleep(1500);
  }
}

export function ensureResearchSessionsCollection(): Promise<void> {
  if (ensured) return ensured;
  ensured = (async () => {
    try {
      await databases.getCollection(DB, COL);
      return;
    } catch {
      // not present
    }
    try {
      await databases.createCollection(DB, COL, "Research Sessions");
    } catch (e: any) {
      if (!/already exists|exists/i.test(String(e?.message))) throw e;
    }
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
      console.error("failed to create research attribute", key);
    };
    await str("status", 32, true);
    await str("owner", 200, true);
    await str("task", 4000, true);
    await str("agents", 2000, true);
    await str("turns", 65000, false);
    await str("conclusion", 65000, false);
    await str("noteId", 200, false);
    await waitForAttributes();
  })().catch((e) => {
    ensured = null;
    throw e;
  });
  return ensured;
}

function safeParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function serialize(doc: any): ResearchSession {
  return {
    id: doc.$id,
    status: doc.status,
    owner: doc.owner,
    task: doc.task ?? "",
    agents: safeParse<ResearchAgentRef[]>(doc.agents, []),
    turns: safeParse<ResearchTurn[]>(doc.turns, []),
    conclusion: doc.conclusion || null,
    noteId: doc.noteId || null,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

export async function createSession(input: {
  owner: string;
  task: string;
  agents: ResearchAgentRef[];
  noteId?: string | null;
}): Promise<ResearchSession> {
  await ensureResearchSessionsCollection();
  const now = new Date().toISOString();
  const doc = await databases.createDocument(DB, COL, ID.unique(), {
    status: "pending",
    owner: input.owner,
    task: input.task,
    agents: JSON.stringify(input.agents),
    turns: "[]",
    conclusion: "",
    noteId: input.noteId ?? "",
    created_at: now,
    updated_at: now,
  });
  return serialize(doc);
}

export async function getSession(id: string): Promise<ResearchSession | null> {
  try {
    const doc = await databases.getDocument(DB, COL, id);
    return serialize(doc);
  } catch {
    return null;
  }
}

export async function getSessionForNote(noteId: string): Promise<ResearchSession | null> {
  try {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal("noteId", noteId),
      Query.orderDesc("created_at"),
      Query.limit(1),
    ]);
    if (!res.documents.length) return null;
    return serialize(res.documents[0]);
  } catch {
    return null;
  }
}

export async function updateSession(
  id: string,
  patch: Partial<{
    status: ResearchStatus;
    task: string;
    turns: ResearchTurn[];
    conclusion: string;
    agents: ResearchAgentRef[];
  }>
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.task !== undefined) payload.task = patch.task;
  if (patch.turns !== undefined) payload.turns = JSON.stringify(patch.turns);
  if (patch.conclusion !== undefined) payload.conclusion = patch.conclusion;
  if (patch.agents !== undefined) payload.agents = JSON.stringify(patch.agents);
  try {
    await databases.updateDocument(DB, COL, id, payload);
  } catch (e) {
    console.error("updateSession failed", id, e);
  }
}
