import { SupabaseClient } from "@supabase/supabase-js";
import { chunkBody } from "./chunking";
import { embedTexts } from "./nvidia";

// Rebuilds knowledge_chunks for one item from its current body. Call after
// every successful knowledge_items insert/update — same wiring shape as
// recordVersion(), so chunks never drift out of sync with content.
export async function reindexChunks(
  supabase: SupabaseClient,
  knowledgeItemId: string,
  body: string
) {
  const { error: deleteError } = await supabase
    .from("knowledge_chunks")
    .delete()
    .eq("knowledge_item_id", knowledgeItemId);
  if (deleteError) {
    throw new Error(`chunk reindex for '${knowledgeItemId}' failed: ${deleteError.message}`);
  }

  const chunks = chunkBody(body);
  if (chunks.length === 0) return;

  const { data: inserted, error: insertError } = await supabase
    .from("knowledge_chunks")
    .insert(
      chunks.map((chunk) => ({
        knowledge_item_id: knowledgeItemId,
        chunk_index: chunk.chunkIndex,
        heading: chunk.heading,
        text: chunk.text,
        start_offset: chunk.startOffset,
        end_offset: chunk.endOffset,
      }))
    )
    .select("id, text");
  if (insertError) {
    throw new Error(`chunk reindex for '${knowledgeItemId}' failed: ${insertError.message}`);
  }

  await embedInsertedChunks(supabase, inserted ?? []);
}

// Best-effort: embeds every freshly-inserted chunk in one batched call and
// writes the vectors back. A missing NVIDIA_API_KEY or a failed API call
// leaves embedding/embedded_at null — chunks stay lexically searchable,
// this never fails the write that triggered reindexing.
async function embedInsertedChunks(
  supabase: SupabaseClient,
  rows: { id: string; text: string }[]
) {
  if (rows.length === 0) return;

  const vectors = await embedTexts(
    rows.map((r) => r.text),
    "passage"
  );
  if (!vectors) return;

  const embeddedAt = new Date().toISOString();
  await Promise.all(
    rows.map((row, i) =>
      supabase
        .from("knowledge_chunks")
        .update({ embedding: vectors[i], embedded_at: embeddedAt })
        .eq("id", row.id)
    )
  );
}
