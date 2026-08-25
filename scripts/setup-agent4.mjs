import { Client, Databases, ID, Storage } from "node-appwrite"

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1")
  .setProject(process.env.APPWRITE_PROJECT_ID || "6a8cf7090015800700cc")
  .setKey(process.env.APPWRITE_API_KEY || "dummy-build-key")

const databases = new Databases(client)
const storage = new Storage(client)
const DB = process.env.APPWRITE_DATABASE_ID

async function safe(fn, label) {
  try {
    await fn()
    console.log("✅", label)
  } catch (e) {
    if (e.code === 409) console.log("↪️  already exists:", label)
    else {
      console.log("❌", label, "-", e.message)
      throw e
    }
  }
}

const str = (col, key, size, required, array = false, def) =>
  databases.createStringAttribute(DB, col, key, size, required, def, array)
const dt = (col, key, required) => databases.createDatetimeAttribute(DB, col, key, required)
const int = (col, key, required, def) => databases.createIntegerAttribute(DB, col, key, required, undefined, undefined, def)
async function idx(col, key, type, attrs, orders) {
  const maxAttempts = 30
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await databases.createIndex(DB, col, key, type, attrs, orders)
      console.log("✅", `idx ${col}.${key}`)
      return
    } catch (e) {
      lastErr = e
      if (e.code === 409) {
        console.log("↪️  already exists:", `idx ${col}.${key}`)
        return
      }
      if (e.type === "attribute_not_available") {
        await new Promise((r) => setTimeout(r, 2000))
        continue
      }
      throw e
    }
  }
  console.log("❌", `idx ${col}.${key}`, "-", lastErr?.message)
  throw lastErr
}

async function setupDatabase() {
  await safe(() => databases.create(DB, "Workspace"), "create database")
}

async function setupKnowledgeItems() {
  const COL = "knowledge_items"
  await safe(() => databases.createCollection(DB, COL, "Knowledge Items"), "create collection: knowledge_items")
  await safe(() => str(COL, "item_id", 255, false), "knowledge_items.item_id")
  await safe(() => str(COL, "type", 255, true), "knowledge_items.type")
  await safe(() => str(COL, "title", 2000, true), "knowledge_items.title")
  await safe(() => str(COL, "slug", 255, true), "knowledge_items.slug")
  await safe(() => str(COL, "content_path", 2000, false), "knowledge_items.content_path")
  await safe(() => str(COL, "content_type", 255, false), "knowledge_items.content_type")
  await safe(() => str(COL, "body", 100000, false), "knowledge_items.body")
  await safe(() => str(COL, "status", 255, false, false, "proposed"), "knowledge_items.status")
  await safe(() => str(COL, "source", 1000, false), "knowledge_items.source")
  await safe(() => str(COL, "author", 1000, false), "knowledge_items.author")
  await safe(() => str(COL, "tags", 255, false, true), "knowledge_items.tags")
  await safe(() => dt(COL, "created_at", true), "knowledge_items.created_at")
  await safe(() => dt(COL, "updated_at", true), "knowledge_items.updated_at")
  await safe(() => idx(COL, "ft_title", "fulltext", ["title"]), "knowledge_items.ft_title")
  await safe(() => idx(COL, "ft_body", "fulltext", ["body"]), "knowledge_items.ft_body")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "knowledge_items.by_created_at")
  await safe(() => idx(COL, "by_slug", "unique", ["slug"]), "knowledge_items.by_slug")
}

async function setupKnowledgeChunks() {
  const COL = "knowledge_chunks"
  await safe(() => databases.createCollection(DB, COL, "Knowledge Chunks"), "create collection: knowledge_chunks")
  await safe(() => str(COL, "knowledge_item_id", 255, true), "knowledge_chunks.knowledge_item_id")
  await safe(() => int(COL, "chunk_index", true), "knowledge_chunks.chunk_index")
  await safe(() => str(COL, "heading", 2000, false), "knowledge_chunks.heading")
  await safe(() => str(COL, "text", 100000, true), "knowledge_chunks.text")
  await safe(() => int(COL, "start_offset", true), "knowledge_chunks.start_offset")
  await safe(() => int(COL, "end_offset", true), "knowledge_chunks.end_offset")
  await safe(() => dt(COL, "created_at", true), "knowledge_chunks.created_at")
  await safe(() => idx(COL, "ft_text", "fulltext", ["text"]), "knowledge_chunks.ft_text")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "knowledge_chunks.by_created_at")
  await safe(() => idx(COL, "by_knowledge_item_id", "key", ["knowledge_item_id"]), "knowledge_chunks.by_knowledge_item_id")
}

async function setupKnowledgeItemVersions() {
  const COL = "knowledge_item_versions"
  await safe(() => databases.createCollection(DB, COL, "Knowledge Item Versions"), "create collection: knowledge_item_versions")
  await safe(() => str(COL, "knowledge_item_id", 255, true), "knowledge_item_versions.knowledge_item_id")
  await safe(() => str(COL, "snapshot", 100000, true), "knowledge_item_versions.snapshot")
  await safe(() => str(COL, "changed_by", 1000, false), "knowledge_item_versions.changed_by")
  await safe(() => str(COL, "change_source", 255, true), "knowledge_item_versions.change_source")
  await safe(() => dt(COL, "created_at", true), "knowledge_item_versions.created_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "knowledge_item_versions.by_created_at")
  await safe(() => idx(COL, "by_knowledge_item_id", "key", ["knowledge_item_id"]), "knowledge_item_versions.by_knowledge_item_id")
}

async function setupKnowledgeSearchHistory() {
  const COL = "knowledge_search_history"
  await safe(() => databases.createCollection(DB, COL, "Knowledge Search History"), "create collection: knowledge_search_history")
  await safe(() => str(COL, "user_email", 255, true), "knowledge_search_history.user_email")
  await safe(() => str(COL, "query", 2000, true), "knowledge_search_history.query")
  await safe(() => str(COL, "mode", 255, false, false, "exact"), "knowledge_search_history.mode")
  await safe(() => int(COL, "result_count", false, 0), "knowledge_search_history.result_count")
  await safe(() => dt(COL, "created_at", true), "knowledge_search_history.created_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "knowledge_search_history.by_created_at")
  await safe(() => idx(COL, "by_user_email", "key", ["user_email"]), "knowledge_search_history.by_user_email")
}

async function setupChatSessions() {
  const COL = "chat_sessions"
  await safe(() => databases.createCollection(DB, COL, "Chat Sessions"), "create collection: chat_sessions")
  await safe(() => str(COL, "user_email", 255, true), "chat_sessions.user_email")
  await safe(() => str(COL, "title", 2000, false, false, "New conversation"), "chat_sessions.title")
  await safe(() => dt(COL, "created_at", true), "chat_sessions.created_at")
  await safe(() => dt(COL, "updated_at", true), "chat_sessions.updated_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "chat_sessions.by_created_at")
  await safe(() => idx(COL, "by_user_email", "key", ["user_email"]), "chat_sessions.by_user_email")
}

async function setupChatMessages() {
  const COL = "chat_messages"
  await safe(() => databases.createCollection(DB, COL, "Chat Messages"), "create collection: chat_messages")
  await safe(() => str(COL, "session_id", 255, true), "chat_messages.session_id")
  await safe(() => str(COL, "role", 255, true), "chat_messages.role")
  await safe(() => str(COL, "content", 100000, true), "chat_messages.content")
  await safe(() => str(COL, "evidence", 100000, false, false, "[]"), "chat_messages.evidence")
  await safe(() => str(COL, "filters", 100000, false, false, "{}"), "chat_messages.filters")
  await safe(() => dt(COL, "created_at", true), "chat_messages.created_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "chat_messages.by_created_at")
  await safe(() => idx(COL, "by_session_id", "key", ["session_id"]), "chat_messages.by_session_id")
}

async function setupFilesBucket() {
  await safe(() => storage.createBucket("files", "Files", undefined, false, false), "create bucket: files")
}

async function main() {
  await setupDatabase()
  await setupKnowledgeItems()
  await setupKnowledgeChunks()
  await setupKnowledgeItemVersions()
  await setupKnowledgeSearchHistory()
  await setupChatSessions()
  await setupChatMessages()
  await setupFilesBucket()
  console.log("🎉 agent4 setup complete")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
