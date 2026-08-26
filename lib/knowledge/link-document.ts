import "server-only"
import { databases } from "@/lib/appwrite/server"
import { ID } from "node-appwrite"
import { APPWRITE } from "@/lib/appwrite/config"
import { reindexChunks } from "@/lib/knowledge/reindex"

const DB = APPWRITE.databaseId
const KCOL = APPWRITE.collections.knowledgeItems
const DCOL = APPWRITE.collections.documents

// knowledge_items.body is capped at 100000 chars at the schema level.
const MAX_BODY = 100_000

function slugify(text: string): string {
  const slug = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return slug || `doc-${Date.now()}`
}

/**
 * Mirrors a Documents/AI-Venture file into Knowledge so it becomes
 * searchable and cross-referenced, without duplicating the underlying file
 * — the documents row stays canonical; this only creates/updates a
 * knowledge_items row pointing back at it via `document_id`, and reindexes
 * its chunks. Best-effort: a failure here must never fail the upload it's
 * attached to, so every error is caught and logged, never thrown.
 */
export async function linkDocumentToKnowledge(opts: {
  documentId: string
  title: string
  text: string
  source: "documents" | "ai-venture"
  author?: string | null
  existingKnowledgeItemId?: string | null
}): Promise<string | null> {
  try {
    const now = new Date().toISOString()
    const body = (opts.text || "").slice(0, MAX_BODY)
    let itemId = opts.existingKnowledgeItemId || null

    if (itemId) {
      await databases.updateDocument(DB, KCOL, itemId, {
        title: opts.title,
        body,
        updated_at: now,
      })
    } else {
      const slug = `${slugify(opts.title)}-${opts.documentId.slice(0, 6)}`
      const doc = await databases.createDocument(DB, KCOL, ID.unique(), {
        item_id: `doc-${opts.documentId}`,
        type: "document",
        title: opts.title,
        slug,
        content_path: `document://${opts.documentId}`,
        content_type: "pdf",
        body,
        status: "active",
        source: opts.source,
        author: opts.author ?? null,
        tags: [],
        document_id: opts.documentId,
        created_at: now,
        updated_at: now,
      })
      itemId = doc.$id
    }

    await reindexChunks(itemId, body)
    await databases.updateDocument(DB, DCOL, opts.documentId, { knowledge_item_id: itemId })
    return itemId
  } catch (err) {
    console.warn("linkDocumentToKnowledge failed (non-fatal):", err)
    return null
  }
}

/** Best-effort removal of the mirrored knowledge_items row + its chunks when a canonical document is permanently deleted. */
export async function unlinkDocumentFromKnowledge(knowledgeItemId: string | null | undefined) {
  if (!knowledgeItemId) return
  try {
    await reindexChunks(knowledgeItemId, "")
    await databases.deleteDocument(DB, KCOL, knowledgeItemId)
  } catch (err) {
    console.warn("unlinkDocumentFromKnowledge failed (non-fatal):", err)
  }
}
