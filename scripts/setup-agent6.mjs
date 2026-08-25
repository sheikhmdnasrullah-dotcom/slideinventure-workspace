import { Client, Databases, Storage, ID } from "node-appwrite"

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

const str = (col, key, size, required, array = false, def = undefined) =>
  databases.createStringAttribute(DB, col, key, size, required, def, array)
const dt = (col, key, required) => databases.createDatetimeAttribute(DB, col, key, required)
const intAttr = (col, key, required, def = undefined) =>
  databases.createIntegerAttribute(DB, col, key, required, undefined, undefined, def)
const bool = (col, key, required, def = undefined) =>
  databases.createBooleanAttribute(DB, col, key, required, def)
const idx = (col, key, type, attrs, orders) =>
  databases.createIndex(DB, col, key, type, attrs, orders)

async function setupDocuments() {
  const COL = "documents"
  await safe(() => databases.createCollection(DB, COL, "Documents"), "create collection: documents")
  await safe(() => str(COL, "title", 255, true), "documents.title")
  await safe(() => str(COL, "filename", 255, true), "documents.filename")
  await safe(() => str(COL, "mime_type", 255, true), "documents.mime_type")
  await safe(() => intAttr(COL, "size_bytes", true), "documents.size_bytes")
  await safe(() => str(COL, "storage_path", 2000, true), "documents.storage_path")
  await safe(() => str(COL, "url", 2000, false), "documents.url")
  await safe(() => str(COL, "tags", 255, false, true), "documents.tags[]")
  await safe(() => str(COL, "status", 255, true), "documents.status")
  await safe(() => str(COL, "author", 320, false), "documents.author")
  await safe(() => str(COL, "source", 255, false), "documents.source")
  await safe(() => dt(COL, "created_at", true), "documents.created_at")
  await safe(() => dt(COL, "updated_at", true), "documents.updated_at")
  await safe(() => idx(COL, "by_status", "key", ["status"]), "documents.idx status")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "documents.idx created_at")
}

async function setupEmailDrafts() {
  const COL = "email_drafts"
  await safe(() => databases.createCollection(DB, COL, "Email Drafts"), "create collection: email_drafts")
  await safe(() => str(COL, "account_id", 255, true), "email_drafts.account_id")
  await safe(() => str(COL, "to", 255, true, true), "email_drafts.to[]")
  await safe(() => str(COL, "cc", 255, false, true), "email_drafts.cc[]")
  await safe(() => str(COL, "bcc", 255, false, true), "email_drafts.bcc[]")
  await safe(() => str(COL, "subject", 2000, false), "email_drafts.subject")
  await safe(() => str(COL, "body", 100000, false), "email_drafts.body")
  await safe(() => str(COL, "reply_to_message_id", 2000, false), "email_drafts.reply_to_message_id")
  await safe(() => str(COL, "created_by", 320, false), "email_drafts.created_by")
  await safe(() => dt(COL, "created_at", true), "email_drafts.created_at")
  await safe(() => dt(COL, "updated_at", true), "email_drafts.updated_at")
  await safe(() => idx(COL, "by_account_id", "key", ["account_id"]), "email_drafts.idx account_id")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "email_drafts.idx created_at")
}

async function setupEmailAttachments() {
  const COL = "email_attachments"
  await safe(() => databases.createCollection(DB, COL, "Email Attachments"), "create collection: email_attachments")
  await safe(() => str(COL, "email_id", 255, true), "email_attachments.email_id")
  await safe(() => str(COL, "filename", 255, true), "email_attachments.filename")
  await safe(() => str(COL, "mime_type", 255, true), "email_attachments.mime_type")
  await safe(() => intAttr(COL, "size_bytes", true), "email_attachments.size_bytes")
  await safe(() => str(COL, "content_id", 2000, false), "email_attachments.content_id")
  await safe(() => str(COL, "disposition", 255, false), "email_attachments.disposition")
  await safe(() => str(COL, "download_url", 2000, false), "email_attachments.download_url")
  await safe(() => dt(COL, "created_at", true), "email_attachments.created_at")
  await safe(() => idx(COL, "by_email_id", "key", ["email_id"]), "email_attachments.idx email_id")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "email_attachments.idx created_at")
}

async function setupMailMessages() {
  const COL = "mail_messages"
  await safe(() => databases.createCollection(DB, COL, "Mail Messages"), "create collection: mail_messages")
  await safe(() => intAttr(COL, "uid", true), "mail_messages.uid")
  await safe(() => str(COL, "folder", 255, true), "mail_messages.folder")
  await safe(() => str(COL, "from", 255, true), "mail_messages.from")
  await safe(() => str(COL, "from_name", 255, false), "mail_messages.from_name")
  await safe(() => str(COL, "to", 255, false, true), "mail_messages.to[]")
  await safe(() => str(COL, "cc", 255, false, true), "mail_messages.cc[]")
  await safe(() => str(COL, "subject", 2000, false), "mail_messages.subject")
  await safe(() => str(COL, "body_text", 100000, false), "mail_messages.body_text")
  await safe(() => str(COL, "body_html", 100000, false), "mail_messages.body_html")
  await safe(() => dt(COL, "sent_at", true), "mail_messages.sent_at")
  await safe(() => bool(COL, "is_read", true), "mail_messages.is_read")
  await safe(() => bool(COL, "has_attachments", true), "mail_messages.has_attachments")
  await safe(() => str(COL, "message_id", 2000, false), "mail_messages.message_id")
  await safe(() => str(COL, "in_reply_to", 2000, false), "mail_messages.in_reply_to")
  await safe(() => str(COL, "labels", 255, false, true), "mail_messages.labels[]")
  await safe(() => dt(COL, "fetched_at", true), "mail_messages.fetched_at")
  await safe(() => str(COL, "account", 320, true), "mail_messages.account")
  await safe(() => str(COL, "message_uid", 767, true), "mail_messages.message_uid")
  await safe(() => idx(COL, "by_folder_sent_at", "key", ["folder", "sent_at"], ["ASC", "DESC"]), "mail_messages.idx folder+sent_at")
  await safe(() => idx(COL, "by_is_read", "key", ["is_read"]), "mail_messages.idx is_read")
  await safe(() => idx(COL, "by_fetched_at", "key", ["fetched_at"], ["DESC"]), "mail_messages.idx fetched_at")
  await safe(() => idx(COL, "by_account", "key", ["account"]), "mail_messages.idx account")
  await safe(() => idx(COL, "by_message_uid", "key", ["message_uid"]), "mail_messages.idx message_uid")
  await safe(() => idx(COL, "ft_subject", "fulltext", ["subject"]), "mail_messages.ft subject")
  await safe(() => idx(COL, "ft_body_text", "fulltext", ["body_text"]), "mail_messages.ft body_text")
  await safe(() => idx(COL, "ft_from_name", "fulltext", ["from_name"]), "mail_messages.ft from_name")
  await safe(() => idx(COL, "ft_from", "fulltext", ["from"]), "mail_messages.ft from")
}

async function setupUsers() {
  const COL = "users"
  await safe(() => databases.createCollection(DB, COL, "Users"), "create collection: users")
  await safe(() => str(COL, "email", 320, true), "users.email")
  await safe(() => str(COL, "full_name", 255, false), "users.full_name")
  await safe(() => str(COL, "avatar_url", 2000, false), "users.avatar_url")
  await safe(() => str(COL, "role", 255, true), "users.role")
  await safe(() => dt(COL, "created_at", true), "users.created_at")
  await safe(() => dt(COL, "updated_at", true), "users.updated_at")
  await safe(() => idx(COL, "by_email", "key", ["email"]), "users.idx email")
  await safe(() => idx(COL, "by_full_name", "key", ["full_name"]), "users.idx full_name")
  await safe(() => idx(COL, "by_role", "key", ["role"]), "users.idx role")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "users.idx created_at")
}

async function main() {
  await safe(() => databases.create(DB, "Workspace"), "create database")
  await setupDocuments()
  await setupEmailDrafts()
  await setupEmailAttachments()
  await setupMailMessages()
  await setupUsers()
  await safe(() => storage.createBucket("files", "files"), "create storage bucket: files")
  console.log("\nDone.")
}

main()
