import fs from "fs"
import path from "path"
import { Client, Databases } from "node-appwrite"
const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath))
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(m[1] in process.env)) process.env[m[1]] = v
  }
const client = new Client().setEndpoint(process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1").setProject(process.env.APPWRITE_PROJECT_ID || "6a8cf7090015800700cc").setKey(process.env.APPWRITE_API_KEY || "dummy-build-key")
const databases = new Databases(client)
const DB = process.env.APPWRITE_DATABASE_ID
const cols = ["notes","boards","secret_vault_entries","knowledge_items","knowledge_chunks","knowledge_item_versions","knowledge_search_history","leads","custom_lead_fields","lead_column_configs","terminal_commands","apps","useful_links","chat_sessions","chat_messages","documents","imported_files","mail_accounts","integrations","task_runs","task_run_events","verification_jobs","entities","relations","working_memory","email_drafts","email_attachments","miro_activity","notion_activity","todoist_tasks","audit_logs","mail_messages","users"]
for (const col of cols) {
  try {
    const r = await databases.listAttributes(DB, col)
    const keys = r.attributes.map(a => a.key + (a.required ? "*" : "") + (a.array ? "[]" : ""))
    console.log(col.padEnd(26), keys.join(", "))
  } catch (e) {
    console.log(col.padEnd(26), "ERR", e.message)
  }
}
