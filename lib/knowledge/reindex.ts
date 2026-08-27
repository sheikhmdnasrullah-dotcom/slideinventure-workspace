import { databases } from "@/lib/appwrite/server"
import { ID, Query } from "node-appwrite"
import { APPWRITE } from "@/lib/appwrite/config"
import { chunkBody } from "./chunking"
import { upsertVector } from "@/lib/retrieval/vector-index"

const DB = APPWRITE.databaseId
const COL = APPWRITE.collections.knowledgeChunks

// Rebuilds knowledge_chunks for one item from its current body. Call after
// every successful knowledge_items insert/update: same wiring shape as
// recordVersion(), so chunks never drift out of sync with content. Every
// caller already funnels through here (add/ingest/publish/[id] update+delete,
// document mirroring), so this is also the single choke point for keeping
// the LanceDB semantic index in sync: real semantic search for Knowledge,
// replacing the fulltext-only fallback in app/api/knowledge/search/route.ts.
export async function reindexChunks(knowledgeItemId: string, body: string) {
  upsertVector({ collection: "knowledge", docId: knowledgeItemId, text: body }).catch(() => {})

  const existing = await databases.listDocuments(DB, COL, [
    Query.equal("knowledge_item_id", knowledgeItemId),
    Query.limit(1000),
  ])
  await Promise.all(
    existing.documents.map((d) => databases.deleteDocument(DB, COL, d.$id))
  )

  const chunks = chunkBody(body ?? "")
  if (chunks.length === 0) return

  await Promise.all(
    chunks.map((chunk) =>
      databases.createDocument(DB, COL, ID.unique(), {
        knowledge_item_id: knowledgeItemId,
        chunk_index: chunk.chunkIndex,
        heading: chunk.heading,
        text: chunk.text,
        start_offset: chunk.startOffset,
        end_offset: chunk.endOffset,
        created_at: new Date().toISOString(),
      })
    )
  )
}
