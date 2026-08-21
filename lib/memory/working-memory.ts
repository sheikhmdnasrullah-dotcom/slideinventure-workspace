/**
 * Working Memory — short-lived scratch space for agent runs and user notes.
 * TTL-based expiry prevents unbounded growth. Promotion to knowledge_items
 * creates audit trail.
 */

import { SupabaseClient } from "@supabase/supabase-js";

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

/**
 * Create a working memory entry with TTL.
 */
export async function createWorkingMemory(
  supabase: SupabaseClient,
  input: CreateWorkingMemoryInput
): Promise<{ success: boolean; entry?: WorkingMemoryEntry; error?: string }> {
  const ttlHours = input.ttl_hours ?? 168; // 1 week default
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  const entry = {
    user_email: input.user_email,
    content: input.content,
    source: input.source ?? "manual",
    context: input.context ?? {},
    expires_at: expiresAt,
  };

  const { data, error } = await supabase
    .from("working_memory")
    .insert(entry)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, entry: data };
}

/**
 * Get working memory entries for a user (non-expired by default).
 */
export async function getWorkingMemory(
  supabase: SupabaseClient,
  userEmail: string,
  options: { includeExpired?: boolean; limit?: number; source?: string } = {}
): Promise<WorkingMemoryEntry[]> {
  let query = supabase
    .from("working_memory")
    .select("*")
    .eq("user_email", userEmail)
    .order("created_at", { ascending: false });

  if (!options.includeExpired) {
    query = query.gt("expires_at", new Date().toISOString());
  }
  if (options.source) {
    query = query.eq("source", options.source);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Working memory fetch failed: ${error.message}`);
  return data ?? [];
}

/**
 * Promote a working memory entry to a knowledge item.
 * Returns the new knowledge_item_id.
 */
export async function promoteToKnowledge(
  supabase: SupabaseClient,
  workingMemoryId: string,
  knowledgeItemId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("working_memory")
    .update({ promoted_to_knowledge_item_id: knowledgeItemId })
    .eq("id", workingMemoryId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Delete a working memory entry.
 */
export async function deleteWorkingMemory(
  supabase: SupabaseClient,
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("working_memory").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Clean up expired entries. Returns count of deleted rows.
 */
export async function cleanupExpiredWorkingMemory(
  supabase: SupabaseClient
): Promise<number> {
  const { count, error } = await supabase
    .from("working_memory")
    .delete()
    .lt("expires_at", new Date().toISOString());

  if (error) throw new Error(`Cleanup failed: ${error.message}`);
  return count ?? 0;
}

/**
 * Get working memory stats for a user.
 */
export async function getWorkingMemoryStats(
  supabase: SupabaseClient,
  userEmail: string
): Promise<WorkingMemoryStats> {
  const { data: all } = await supabase
    .from("working_memory")
    .select("source, expires_at, promoted_to_knowledge_item_id")
    .eq("user_email", userEmail);

  const entries = (all ?? []) as Array<{ source: string; expires_at: string; promoted_to_knowledge_item_id: string | null }>;
  const now = new Date().toISOString();

  return {
    total: entries.length,
    expired: entries.filter((e) => e.expires_at < now).length,
    promoted: entries.filter((e) => e.promoted_to_knowledge_item_id).length,
    by_source: entries.reduce((acc: Record<string, number>, e) => {
      acc[e.source] = (acc[e.source] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}