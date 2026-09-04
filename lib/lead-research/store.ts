import "server-only";
import { databases, ID, Query } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import type {
  LeadResearchRow,
  LeadResearchSession,
  SessionStatus,
} from "./types";

const DB = APPWRITE.databaseId;
const COL = "lead_research_sessions";

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
      const keys = new Set((attrs.attributes ?? []).map((a) => a.key));
      if (
        keys.has("status") &&
        keys.has("owner") &&
        keys.has("fileName") &&
        keys.has("rows") &&
        keys.has("discoveredColumns") &&
        keys.has("agentSlugs") &&
        keys.has("progress") &&
        keys.has("doneCount") &&
        keys.has("totalCount")
      ) {
        return;
      }
    } catch {
      // still provisioning
    }
    await sleep(1500);
  }
}

function ensureLeadResearchCollection(): Promise<void> {
  if (ensured) return ensured;
  ensured = (async () => {
    try {
      await databases.getCollection(DB, COL);
    } catch {
      try {
        await databases.createCollection(DB, COL, "Lead Research Sessions");
      } catch (e: unknown) {
        if (!/already exists|exists/i.test(String((e as { message?: unknown })?.message))) throw e;
      }
    }
    await waitForCollection();
    const str = async (key: string, size: number, required: boolean) => {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await databases.createStringAttribute(DB, COL, key, size, required);
          return;
        } catch (e: unknown) {
          if (/already exists|exists/i.test(String((e as { message?: unknown })?.message))) return;
          await sleep(1000);
        }
      }
      console.error("failed to create lead-research attribute", key);
    };
    await str("status", 32, true);
    await str("owner", 200, true);
    await str("fileName", 255, true);
    await str("rows", 16_000_000, false);
    await str("discoveredColumns", 4000, false);
    await str("agentSlugs", 2000, false);
    await str("progress", 32, false);
    await str("doneCount", 32, false);
    await str("totalCount", 32, false);
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

type LeadResearchDoc = Record<string, unknown>;

function strField(doc: LeadResearchDoc, key: string, fallback = ""): string {
  const v = doc[key];
  return typeof v === "string" ? v : fallback;
}

function serialize(doc: LeadResearchDoc): LeadResearchSession {
  const rows = safeParse<LeadResearchRow[]>(doc.rows, []);
  return {
    id: strField(doc, "$id"),
    owner: strField(doc, "owner"),
    status: (strField(doc, "status", "pending") as SessionStatus) ?? "pending",
    fileName: strField(doc, "fileName"),
    rows,
    discoveredColumns: safeParse<string[]>(doc.discoveredColumns, []),
    agentSlugs: safeParse<string[]>(doc.agentSlugs, []),
    progress: Number(doc.progress ?? 0),
    doneCount: rows.filter((r) => r.status !== "pending" && r.status !== "researching").length,
    totalCount: rows.length,
    createdAt: strField(doc, "created_at"),
    updatedAt: strField(doc, "updated_at"),
  };
}

export async function createSession(input: {
  owner: string;
  fileName: string;
  rows: LeadResearchRow[];
  discoveredColumns: string[];
  agentSlugs: string[];
}): Promise<LeadResearchSession> {
  await ensureLeadResearchCollection();
  const now = new Date().toISOString();
  const doc = await databases.createDocument(DB, COL, ID.unique(), {
    status: "pending",
    owner: input.owner,
    fileName: input.fileName,
    rows: JSON.stringify(input.rows),
    discoveredColumns: JSON.stringify(input.discoveredColumns),
    agentSlugs: JSON.stringify(input.agentSlugs),
    progress: 0,
    doneCount: 0,
    totalCount: input.rows.length,
    created_at: now,
    updated_at: now,
  });
  return serialize(doc);
}

export async function getSession(id: string): Promise<LeadResearchSession | null> {
  try {
    const doc = await databases.getDocument(DB, COL, id);
    return serialize(doc);
  } catch {
    return null;
  }
}

export async function listSessions(owner: string): Promise<LeadResearchSession[]> {
  try {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal("owner", owner),
      Query.orderDesc("created_at"),
      Query.limit(50),
    ]);
    return res.documents.map(serialize);
  } catch {
    return [];
  }
}

export async function updateSession(
  id: string,
  patch: Partial<{
    status: SessionStatus;
    rows: LeadResearchRow[];
    progress: number;
    doneCount: number;
    totalCount: number;
  }>
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.rows !== undefined) {
    payload.rows = JSON.stringify(patch.rows);
    payload.totalCount = patch.rows.length;
    payload.doneCount = patch.rows.filter(
      (r) => r.status !== "pending" && r.status !== "researching"
    ).length;
  }
  if (patch.progress !== undefined) payload.progress = patch.progress;
  if (patch.doneCount !== undefined) payload.doneCount = patch.doneCount;
  if (patch.totalCount !== undefined) payload.totalCount = patch.totalCount;
  try {
    await databases.updateDocument(DB, COL, id, payload);
  } catch (e) {
    console.error("updateSession failed", id, e);
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    await databases.deleteDocument(DB, COL, id);
  } catch {
    /* ignore */
  }
}
