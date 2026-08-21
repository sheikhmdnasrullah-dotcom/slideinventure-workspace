import { SupabaseClient } from "@supabase/supabase-js";

// Snapshots a knowledge_items row into knowledge_item_versions before it's
// overwritten. Call with the row as it existed *before* the write.
export async function recordVersion(
  supabase: SupabaseClient,
  knowledgeItemId: string,
  previousRow: Record<string, unknown>,
  changeSource: string,
  changedBy?: string | null
) {
  const { error } = await supabase.from("knowledge_item_versions").insert({
    knowledge_item_id: knowledgeItemId,
    snapshot: previousRow,
    changed_by: changedBy ?? null,
    change_source: changeSource,
  });
  if (error) {
    throw new Error(`version snapshot for '${knowledgeItemId}' failed: ${error.message}`);
  }
}
