/**
 * Working Memory: short-lived scratch space for agent runs and user notes.
 * TTL-based expiry prevents unbounded growth. Promotion to knowledge_items
 * creates audit trail.
 */

import { databases, ID } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.workingMemory;

export interface WorkingMemoryEntry {
  id: string;
  user_email: string;
  content: string;
  source: string | null;
  context: Record<string, unknown>;
  expires_at: string;
  created_at: string;
  promoted_to_knowledge_item_id: string | null;
}

export interface CreateWorkingMemoryInput {
  user_email: string;
  content: string;
  source?: string;
  context?: Record<string, unknown>;
  ttl_hours?: number;
}

export interface WorkingMemoryStats {
  total: number;
  expired: number;
  promoted: number;
  by_source: Record<string, number>;
}

function parseContext(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return (value as Record<string, unknown>) ?? {};
}

function serialize(doc: Record<string, any>): WorkingMemoryEntry {
  return {
    id: doc.$id,
    user_email: doc.user_email,
    content: doc.content,
    source: doc.source ?? null,
    context: parseContext(doc.context),
    expires_at: doc.expires_at,
    created_at: doc.created_at,
    promoted_to_knowledge_item_id: doc.promoted_to_knowledge_item_id ?? null,
  };
}

/**
 * Create a working memory entry with TTL.
 */
export async function createWorkingMemory(
  input: CreateWorkingMemoryInput
): Promise<{ success: boolean; entry?: WorkingMemoryEntry; error?: string }> {
  const ttlHours = input.ttl_hours ?? 168; // 1 week default
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  try {
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      user_email: input.user_email,
      content: input.content,
      source: input.source ?? "manual",
      context: JSON.stringify(input.context ?? {}),
      expires_at: expiresAt,
      promoted_to_knowledge_item_id: null,
      created_at: now,
    });
    return { success: true, entry: serialize(doc) };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to create working memory" };
  }
}

/**
 * Get working memory entries for a user (non-expired by default).
 */
export async function getWorkingMemory(
  userEmail: string,
  options: { includeExpired?: boolean; limit?: number; source?: string } = {}
): Promise<WorkingMemoryEntry[]> {
  const queries: string[] = [Query.equal("user_email", userEmail)];

  if (!options.includeExpired) {
    queries.push(Query.greaterThanEqual("expires_at", new Date().toISOString()));
  }
  if (options.source) {
    queries.push(Query.equal("source", options.source));
  }
  queries.push(Query.orderDesc("created_at"));
  if (options.limit) queries.push(Query.limit(options.limit));

  const res = await databases.listDocuments(DB, COL, queries);
  return res.documents.map(serialize);
}

/**
 * Promote a working memory entry to a knowledge item.
 * Returns the new knowledge_item_id.
 */
export async function promoteToKnowledge(
  workingMemoryId: string,
  knowledgeItemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await databases.updateDocument(DB, COL, workingMemoryId, {
      promoted_to_knowledge_item_id: knowledgeItemId,
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to promote" };
  }
}

/**
 * Delete a working memory entry.
 */
export async function deleteWorkingMemory(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await databases.deleteDocument(DB, COL, id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to delete" };
  }
}

/**
 * Clean up expired entries. Returns count of deleted rows.
 */
export async function cleanupExpiredWorkingMemory(): Promise<number> {
  const res = await databases.listDocuments(DB, COL, [
    Query.lessThan("expires_at", new Date().toISOString()),
    Query.limit(1000),
  ]);

  let deleted = 0;
  for (const doc of res.documents) {
    await databases.deleteDocument(DB, COL, doc.$id);
    deleted++;
  }
  return deleted;
}

/**
 * Get working memory stats for a user.
 */
export async function getWorkingMemoryStats(
  userEmail: string
): Promise<WorkingMemoryStats> {
  const res = await databases.listDocuments(DB, COL, [
    Query.equal("user_email", userEmail),
    Query.limit(5000),
  ]);

  const entries = res.documents.map(serialize);
  const now = new Date().toISOString();

  return {
    total: entries.length,
    expired: entries.filter((e) => e.expires_at < now).length,
    promoted: entries.filter((e) => e.promoted_to_knowledge_item_id).length,
    by_source: entries.reduce((acc: Record<string, number>, e) => {
      const k = e.source ?? "unknown";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}
