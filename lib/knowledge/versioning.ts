import { databases } from "@/lib/appwrite/server"
import { ID } from "node-appwrite"
import { APPWRITE } from "@/lib/appwrite/config"

const DB = APPWRITE.databaseId
const COL = APPWRITE.collections.knowledgeItemVersions

// Snapshots a knowledge_items row into knowledge_item_versions before it's
// overwritten. Call with the row as it existed *before* the write.
export async function recordVersion(
  knowledgeItemId: string,
  previousRow: Record<string, unknown>,
  changeSource: string,
  changedBy?: string | null
) {
  await databases.createDocument(DB, COL, ID.unique(), {
    knowledge_item_id: knowledgeItemId,
    snapshot: JSON.stringify(previousRow ?? {}),
    changed_by: changedBy ?? null,
    change_source: changeSource,
    created_at: new Date().toISOString(),
  })
}
