import { Client, Databases, ID } from "node-appwrite"

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)

const databases = new Databases(client)
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

const str = (col, key, size, required, array = false) =>
  databases.createStringAttribute(DB, col, key, size, required, undefined, array)
const dt = (col, key, required) => databases.createDatetimeAttribute(DB, col, key, required)
const int = (col, key, required) => databases.createIntegerAttribute(DB, col, key, required)
const bool = (col, key, required) => databases.createBooleanAttribute(DB, col, key, required)
const idx = (col, key, type, attrs, orders) =>
  databases.createIndex(DB, col, key, type, attrs, orders)

async function setupNotes() {
  const COL = "notes"
  await safe(() => databases.createCollection(DB, COL, "Notes"), "create collection: notes")
  await safe(() => str(COL, "user_email", 320, true), "notes.user_email")
  await safe(() => str(COL, "title", 255, false), "notes.title")
  await safe(() => str(COL, "content", 100000, false), "notes.content")
  await safe(() => dt(COL, "created_at", true), "notes.created_at")
  await safe(() => dt(COL, "updated_at", true), "notes.updated_at")
  await safe(() => idx(COL, "by_user_email", "key", ["user_email"]), "notes.idx user_email")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "notes.idx created_at")
}

async function setupVault() {
  const COL = "secret_vault_entries"
  await safe(() => databases.createCollection(DB, COL, "Secret Vault Entries"), "create collection: vault")
  await safe(() => str(COL, "name", 255, true), "vault.name")
  await safe(() => str(COL, "category", 255, false), "vault.category")
  await safe(() => str(COL, "service_name", 255, false), "vault.service_name")
  await safe(() => str(COL, "username", 255, false), "vault.username")
  await safe(() => str(COL, "secret_type", 255, true), "vault.secret_type")
  await safe(() => str(COL, "url", 2000, false), "vault.url")
  await safe(() => str(COL, "notes", 100000, false), "vault.notes")
  await safe(() => str(COL, "tags", 255, false, true), "vault.tags[]")
  await safe(() => str(COL, "encrypted_value", 100000, true), "vault.encrypted_value")
  await safe(() => str(COL, "iv", 255, true), "vault.iv")
  await safe(() => int(COL, "key_version", true), "vault.key_version")
  await safe(() => dt(COL, "expires_at", false), "vault.expires_at")
  await safe(() => str(COL, "created_by", 320, true), "vault.created_by")
  await safe(() => dt(COL, "created_at", true), "vault.created_at")
  await safe(() => dt(COL, "updated_at", true), "vault.updated_at")
  await safe(() => idx(COL, "by_created_by", "key", ["created_by"]), "vault.idx created_by")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "vault.idx created_at")
  await safe(() => idx(COL, "ft_name", "fulltext", ["name"]), "vault.ft name")
  await safe(() => idx(COL, "ft_service_name", "fulltext", ["service_name"]), "vault.ft service_name")
  await safe(() => idx(COL, "ft_username", "fulltext", ["username"]), "vault.ft username")
}

async function main() {
  await safe(() => databases.create(DB, "Workspace"), "create database")
  await setupNotes()
  await setupVault()
  console.log("\nDone.")
}

main()
