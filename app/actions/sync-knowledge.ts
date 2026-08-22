"use server";

import { requireUser } from "@/lib/supabase/server";
import { syncKnowledge } from "@/lib/knowledge/sync";

export async function syncKnowledgeBase() {
  await requireUser();

  try {
    const count = await syncKnowledge();
    return { success: true, output: `Synced ${count} items`, counters: { created: [], updated: [], skipped: [], failed: [] } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return { success: false, counters: { created: [], updated: [], skipped: [], failed: [] }, output: message };
  }
}
