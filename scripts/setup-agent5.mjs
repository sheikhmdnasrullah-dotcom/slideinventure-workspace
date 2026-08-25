import { Client, Databases, ID } from "node-appwrite"

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1")
  .setProject(process.env.APPWRITE_PROJECT_ID || "6a8cf7090015800700cc")
  .setKey(process.env.APPWRITE_API_KEY || "dummy-build-key")

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

const str = (col, key, size, required, def, array = false) =>
  databases.createStringAttribute(DB, col, key, size, required, def, array)
const dt = (col, key, required) => databases.createDatetimeAttribute(DB, col, key, required)
const int = (col, key, required) => databases.createIntegerAttribute(DB, col, key, required)
const idx = (col, key, type, attrs, orders) =>
  databases.createIndex(DB, col, key, type, attrs, orders)

async function setupLeads() {
  const COL = "leads"
  await safe(() => databases.createCollection(DB, COL, "Leads"), "create collection: leads")
  await safe(() => str(COL, "first_name", 255, true), "leads.first_name")
  await safe(() => str(COL, "last_name", 255, true), "leads.last_name")
  await safe(() => str(COL, "email", 255, true), "leads.email")
  await safe(() => str(COL, "company", 255, false), "leads.company")
  await safe(() => str(COL, "job_title", 255, false), "leads.job_title")
  await safe(() => str(COL, "phone", 255, false), "leads.phone")
  await safe(() => str(COL, "source", 255, true), "leads.source")
  await safe(() => str(COL, "status", 255, true), "leads.status")
  await safe(() => str(COL, "notes", 100000, false), "leads.notes")
  await safe(() => str(COL, "tags", 255, false, undefined, true), "leads.tags[]")
  await safe(() => dt(COL, "last_contacted_at", false), "leads.last_contacted_at")
  await safe(() => str(COL, "custom_fields", 100000, false), "leads.custom_fields")
  await safe(() => dt(COL, "created_at", true), "leads.created_at")
  await safe(() => dt(COL, "updated_at", true), "leads.updated_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "leads.idx created_at")
  await safe(() => idx(COL, "by_email", "key", ["email"]), "leads.idx email")
  await safe(() => idx(COL, "by_status", "key", ["status"]), "leads.idx status")
}

async function setupImportedFiles() {
  const COL = "imported_files"
  await safe(() => databases.createCollection(DB, COL, "Imported Files"), "create collection: imported_files")
  await safe(() => str(COL, "filename", 255, true), "imported_files.filename")
  await safe(() => str(COL, "mime_type", 255, true), "imported_files.mime_type")
  await safe(() => int(COL, "size_bytes", true), "imported_files.size_bytes")
  await safe(() => str(COL, "storage_path", 2000, false), "imported_files.storage_path")
  await safe(() => str(COL, "url", 2000, false), "imported_files.url")
  await safe(() => str(COL, "mapping", 100000, false), "imported_files.mapping")
  await safe(() => int(COL, "row_count", false), "imported_files.row_count")
  await safe(() => int(COL, "imported_count", false), "imported_files.imported_count")
  await safe(() => int(COL, "error_count", false), "imported_files.error_count")
  await safe(() => str(COL, "status", 255, true), "imported_files.status")
  await safe(() => str(COL, "errors", 255, false, undefined, true), "imported_files.errors[]")
  await safe(() => str(COL, "imported_by", 320, false), "imported_files.imported_by")
  await safe(() => dt(COL, "created_at", true), "imported_files.created_at")
  await safe(() => dt(COL, "completed_at", false), "imported_files.completed_at")
  await safe(() => idx(COL, "by_status", "key", ["status"]), "imported_files.idx status")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "imported_files.idx created_at")
}

async function main() {
  await safe(() => databases.create(DB, "Workspace"), "create database")
  await setupLeads()
  await setupImportedFiles()
  console.log("\nDone.")
}

main()
