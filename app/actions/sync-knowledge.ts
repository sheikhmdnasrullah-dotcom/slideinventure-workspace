"use server";

import { requireUser } from "@/lib/supabase/server";
import { syncKnowledge, type SyncResult } from "@/lib/knowledge/sync";

export async function syncKnowledgeBase(): Promise<SyncResult> {
  await requireUser();

  try {
    return await syncKnowledge(process.cwd());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return { success: false, counters: { created: [], updated: [], skipped: [], failed: [] }, output: message };
  }
}
