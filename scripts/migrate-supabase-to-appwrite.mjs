// One-time migration: Supabase Postgres -> Appwrite
// Run: node scripts/migrate-supabase-to-appwrite.mjs (env sourced from .env.local)
import fs from "fs"
import path from "path"
import { createClient as createSupabase } from "@supabase/supabase-js"
import { Client, Databases, ID } from "node-appwrite"

// ---- load .env.local ----
const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(m[1] in process.env)) process.env[m[1]] = v
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DB = process.env.APPWRITE_DATABASE_ID

if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase env missing")
if (!DB || !process.env.APPWRITE_ENDPOINT || !process.env.APPWRITE_API_KEY || !process.env.APPWRITE_PROJECT_ID)
  throw new Error("Appwrite env missing")

const sb = createSupabase(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1")
  .setProject(process.env.APPWRITE_PROJECT_ID || "6a8cf7090015800700cc")
  .setKey(process.env.APPWRITE_API_KEY || "dummy-build-key")
const databases = new Databases(client)

// table -> collection id (exact strings from instructions)
const TABLE_MAP = {
  notes: "notes",
  boards: "boards",
  secret_vault_entries: "secret_vault_entries",
  knowledge_items: "knowledge_items",
  knowledge_chunks: "knowledge_chunks",
  knowledge_item_versions: "knowledge_item_versions",
  knowledge_search_history: "knowledge_search_history",
  leads: "leads",
  custom_lead_fields: "custom_lead_fields",
  lead_column_configs: "lead_column_configs",
  terminal_commands: "terminal_commands",
  apps: "apps",
  useful_links: "useful_links",
  chat_sessions: "chat_sessions",
  chat_messages: "chat_messages",
  documents: "documents",
  imported_files: "imported_files",
  mail_accounts: "mail_accounts",
  integrations: "integrations",
  task_runs: "task_runs",
  task_run_events: "task_run_events",
  verification_jobs: "verification_jobs",
  entities: "entities",
  relations: "relations",
  working_memory: "working_memory",
  email_drafts: "email_drafts",
  email_attachments: "email_attachments",
  miro_activity: "miro_activity",
  notion_activity: "notion_activity",
  todoist_tasks: "todoist_tasks",
  audit_logs: "audit_logs",
  mail_messages: "mail_messages",
  users: "users",
}

// tables whose Appwrite collection has a dedicated attribute that should hold
// the source's natural primary key (source row.id) so FKs can be re-resolved.
const TABLE_OLD_ID_ATTR = {
  knowledge_items: "item_id",
  entities: "entity_id",
}

function singularize(table) {
  return table.endsWith("s") ? table.slice(0, -1) : table
}

// given the table and its Appwrite attributes, return the attribute key that
// should store the source primary key (row.id), or null if none.
function oldIdAttrFor(table, attrs) {
  if (TABLE_OLD_ID_ATTR[table] && attrs.some((a) => a.key === TABLE_OLD_ID_ATTR[table]))
    return TABLE_OLD_ID_ATTR[table]
  const candidate = `${singularize(table)}_id`
  if (attrs.some((a) => a.key === candidate)) return candidate
  return null
}

// known explicit FKs (child column -> parent table)
const EXPLICIT_FK = {
  knowledge_chunks: { knowledge_item_id: "knowledge_items" },
  knowledge_item_versions: { knowledge_item_id: "knowledge_items" },
  chat_messages: { session_id: "chat_sessions" },
}

const idMap = {} // idMap[parentTable][oldId] = newAppwriteId
for (const t of Object.keys(TABLE_MAP)) idMap[t] = {}
const newIdsSeen = [] // every Appwrite doc id we created or skipped (for remap detection)

const failedRows = [] // {table, row, reason}
const skipped = []
const summary = [] // {collection, source, target}

async function fetchAll(table) {
  const rows = []
  let from = 0
  const PAGE = 1000
  for (;;) {
    const { data, error } = await sb.from(table).select("*").range(from, from + PAGE - 1)
    if (error) throw new Error(`supabase select ${table}: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows
}

function buildDoc(row, attrs, table) {
  const attrByKey = {}
  for (const a of attrs) attrByKey[a.key] = a
  const doc = {}
  for (const [col, val] of Object.entries(row)) {
    if (col === "id") continue // handled via TABLE_OLD_ID_ATTR or dropped
    const attr = attrByKey[col]
    if (!attr) continue // only copy columns that map to an attribute
    doc[col] = transform(val, attr)
  }
  // store natural old id into dedicated attribute if present
  const oldIdAttr = oldIdAttrFor(table, attrs)
  if (oldIdAttr && row.id !== undefined) {
    doc[oldIdAttr] = String(row.id)
  }
  return doc
}

function transform(val, attr) {
  if (val === null || val === undefined) return null
  const isArrayAttr = attr.array === true
  if (isArrayAttr) {
    // array attribute: pass JS array as-is (Postgres array -> JS array)
    return Array.isArray(val) ? val : [val]
  }
  switch (attr.type) {
    case "datetime":
      return val // ISO string or null
    case "integer":
      return typeof val === "number" ? val : Number(val)
    case "boolean":
      return typeof val === "boolean" ? val : Boolean(val)
    case "string":
    default:
      if (typeof val === "object") return JSON.stringify(val) // jsonb -> string
      return val
  }
}

function findRemap(column, value) {
  if (value === null || value === undefined || value === "") return null
  // explicit known FK
  // search all idMaps for this value (best-effort)
  for (const t of Object.keys(idMap)) {
    if (idMap[t][value] !== undefined) return idMap[t][value]
  }
  return null
}

async function listCount(col) {
  const res = await databases.listDocuments(DB, col, [])
  return res.total
}

async function getAttrs(col) {
  const res = await databases.listAttributes(DB, col)
  return res.attributes
}

async function main() {
  // ---- PASS 1: create all documents, build idMap ----
  for (const [table, col] of Object.entries(TABLE_MAP)) {
    let rows
    try {
      rows = await fetchAll(table)
    } catch (e) {
      console.log(`❌ fetch ${table}: ${e.message}`)
      failedRows.push({ table, row: null, reason: `fetch: ${e.message}` })
      summary.push({ collection: col, source: "ERR", target: 0 })
      continue
    }

    let attrs
    try {
      attrs = await getAttrs(col)
    } catch (e) {
      console.log(`⚠️  ${col}: cannot list attributes (${e.message}) — skipping`)
      skipped.push(`${col}: no attributes (${e.message})`)
      summary.push({ collection: col, source: rows.length, target: 0 })
      continue
    }

    // re-run safety: skip if already populated
    const existing = await listCount(col)
    if (existing > 0) {
      console.log(`↪️  skipped ${col}, already has ${existing} docs`)
      skipped.push(`${col}: already has ${existing} docs`)
      // rebuild idMap from existing docs if old-id attr exists
      try {
        const res = await databases.listDocuments(DB, col, [])
        const oldIdAttr = oldIdAttrFor(table, attrs)
        for (const d of res.documents) {
          newIdsSeen.push(d.$id)
          if (oldIdAttr && d[oldIdAttr] != null) idMap[table][String(d[oldIdAttr])] = d.$id
        }
      } catch {}
      summary.push({ collection: col, source: rows.length, target: existing })
      continue
    }

    let created = 0
    for (const row of rows) {
      const doc = buildDoc(row, attrs, table)
      // do NOT remap FKs yet; keep original values (pass 2 will remap)
      try {
        const newDoc = await databases.createDocument(DB, col, ID.unique(), doc)
        const pk = row.id
        if (pk !== undefined) idMap[table][String(pk)] = newDoc.$id
        newIdsSeen.push(newDoc.$id)
        created++
      } catch (e) {
        failedRows.push({ table, row: row.id ?? "(no id)", reason: e.message })
        console.log(`❌ ${col} row ${row.id ?? "?"}: ${e.message}`)
      }
    }
    console.log(`✅ ${col}: ${created}/${rows.length} created`)
    summary.push({ collection: col, source: rows.length, target: created })
  }

  // ---- PASS 2: remap FK _id columns via updateDocument ----
  // Build per-collection natural-id maps: naturalId -> new $id. Namespaced by
  // collection to avoid collisions between different tables' natural ids.
  console.log("\n--- FK remap pass ---")
  const naturalMaps = {} // naturalMaps[table] = Map(oldNaturalId -> $id)
  for (const [table, col] of Object.entries(TABLE_MAP)) {
    try {
      const attrs = await getAttrs(col)
      const na = oldIdAttrFor(table, attrs)
      if (!na) continue
      const res = await databases.listDocuments(DB, col, [])
      const m = new Map()
      for (const d of res.documents) if (d[na] != null) m.set(String(d[na]), d.$id)
      naturalMaps[table] = m
    } catch {}
  }
  // explicit child-column -> parent table for FK resolution
  const FK_PARENT = {
    knowledge_chunks: { knowledge_item_id: "knowledge_items" },
    knowledge_item_versions: { knowledge_item_id: "knowledge_items" },
    chat_messages: { session_id: "chat_sessions" },
    relations: { from_entity_id: "entities", to_entity_id: "entities", source_knowledge_item_id: "knowledge_items" },
  }
  for (const [table, col] of Object.entries(TABLE_MAP)) {
    let attrs
    try {
      attrs = await getAttrs(col)
    } catch {
      continue
    }
    const ownNatural = oldIdAttrFor(table, attrs) // never remap a doc's own id attr
    let res
    try {
      res = await databases.listDocuments(DB, col, [])
    } catch {
      continue
    }
    const fk = FK_PARENT[table] || {}
    let updated = 0
    for (const d of res.documents) {
      const patch = {}
      // candidate FK columns: explicit + any *_id column (best effort)
      const candCols = new Set([...Object.keys(fk), ...Object.keys(d).filter((k) => k.endsWith("_id") && k !== "$id" && k !== ownNatural)])
      for (const column of candCols) {
        const original = d[column]
        if (original == null) continue
        let target = null
        if (fk[column]) {
          const m = naturalMaps[fk[column]]
          if (m && m.has(String(original))) target = m.get(String(original))
          else if (idMap[fk[column]] && idMap[fk[column]][String(original)] !== undefined)
            target = idMap[fk[column]][String(original)]
        } else {
          // best-effort: use the ONLY collection whose natural map contains it
          const hits = Object.entries(naturalMaps).filter(([, m]) => m.has(String(original)))
          if (hits.length === 1) target = hits[0][1].get(String(original))
          else {
            const h2 = Object.entries(idMap).filter(([, m]) => m[String(original)] !== undefined)
            if (h2.length === 1) target = h2[0][1][String(original)]
          }
        }
        if (target && target !== original) patch[column] = target
        else if (fk[column] && target === undefined && naturalMaps[fk[column]] && naturalMaps[fk[column]].size > 0)
          failedRows.push({ table, row: d.$id, reason: `fk ${column}: parent ${fk[column]} id ${original} not found` })
      }
      if (Object.keys(patch).length > 0) {
        try {
          await databases.updateDocument(DB, col, d.$id, patch)
          updated++
        } catch (e) {
          failedRows.push({ table, row: d.$id, reason: `fk-update: ${e.message}` })
        }
      }
    }
    if (updated > 0) console.log(`🔗 ${col}: remapped ${updated} docs`)
  }

  // ---- SUMMARY ----
  console.log("\n================ MIGRATION SUMMARY ================")
  console.log("collection".padEnd(28), "source".padStart(8), "target".padStart(8), "flag")
  let mismatch = 0
  for (const s of summary) {
    const src = typeof s.source === "number" ? s.source : "-"
    const flag = s.source !== "ERR" && typeof s.source === "number" && s.source - s.target > 0 ? "⚠ MISMATCH" : ""
    if (flag) mismatch++
    console.log(
      String(s.collection).padEnd(28),
      String(src).padStart(8),
      String(s.target).padStart(8),
      flag
    )
  }
  console.log("\nSkipped tables:", skipped.length ? skipped.join("; ") : "none")
  console.log("Failed rows:", failedRows.length)
  for (const f of failedRows.slice(0, 50)) {
    console.log(`  - ${f.table} [${f.row}]: ${f.reason}`)
  }
  if (failedRows.length > 50) console.log(`  ... and ${failedRows.length - 50} more`)
  console.log("\nCollections with mismatch:", mismatch)
  console.log("==================================================")
}

main().catch((e) => {
  console.error("FATAL", e)
  process.exit(1)
})
