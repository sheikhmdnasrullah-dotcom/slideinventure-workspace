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

async function setupIntegrations() {
  const COL = "integrations"
  await safe(() => databases.createCollection(DB, COL, "Integrations"), "create collection: integrations")
  await safe(() => str(COL, "name", 255, true), "integrations.name")
  await safe(() => str(COL, "provider", 255, true), "integrations.provider")
  await safe(() => str(COL, "type", 255, true), "integrations.type")
  await safe(() => str(COL, "status", 255, true), "integrations.status")
  await safe(() => str(COL, "config", 100000, false), "integrations.config")
  await safe(() => dt(COL, "last_sync_at", false), "integrations.last_sync_at")
  await safe(() => str(COL, "last_error", 100000, false), "integrations.last_error")
  await safe(() => str(COL, "created_by", 320, false), "integrations.created_by")
  await safe(() => dt(COL, "created_at", true), "integrations.created_at")
  await safe(() => dt(COL, "updated_at", true), "integrations.updated_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "integrations.idx created_at")
  await safe(() => idx(COL, "by_created_by", "key", ["created_by"]), "integrations.idx created_by")
  await safe(() => idx(COL, "by_provider", "key", ["provider"]), "integrations.idx provider")
  await safe(() => idx(COL, "by_status", "key", ["status"]), "integrations.idx status")
}

async function setupMailAccounts() {
  const COL = "mail_accounts"
  await safe(() => databases.createCollection(DB, COL, "Mail Accounts"), "create collection: mail_accounts")
  await safe(() => str(COL, "email", 320, true), "mail_accounts.email")
  await safe(() => str(COL, "name", 255, true), "mail_accounts.name")
  await safe(() => str(COL, "provider", 255, true), "mail_accounts.provider")
  await safe(() => str(COL, "imap_host", 255, false), "mail_accounts.imap_host")
  await safe(() => int(COL, "imap_port", false), "mail_accounts.imap_port")
  await safe(() => str(COL, "smtp_host", 255, false), "mail_accounts.smtp_host")
  await safe(() => int(COL, "smtp_port", false), "mail_accounts.smtp_port")
  await safe(() => str(COL, "encrypted_password", 100000, false), "mail_accounts.encrypted_password")
  await safe(() => str(COL, "created_by", 320, false), "mail_accounts.created_by")
  await safe(() => dt(COL, "created_at", true), "mail_accounts.created_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "mail_accounts.idx created_at")
  await safe(() => idx(COL, "by_created_by", "key", ["created_by"]), "mail_accounts.idx created_by")
  await safe(() => idx(COL, "by_email", "unique", ["email"]), "mail_accounts.idx email (unique)")
}

async function setupEntities() {
  const COL = "entities"
  await safe(() => databases.createCollection(DB, COL, "Entities"), "create collection: entities")
  await safe(() => str(COL, "entity_id", 320, true), "entities.entity_id")
  await safe(() => str(COL, "type", 255, true), "entities.type")
  await safe(() => str(COL, "name", 255, true), "entities.name")
  await safe(() => str(COL, "entity_type", 255, false), "entities.entity_type")
  await safe(() => str(COL, "properties", 100000, false), "entities.properties")
  await safe(() => str(COL, "source", 255, false), "entities.source")
  await safe(() => idx(COL, "by_entity_id", "key", ["entity_id"]), "entities.idx entity_id")
  await safe(() => idx(COL, "by_entity_type", "key", ["entity_type"]), "entities.idx entity_type")
  await safe(() => idx(COL, "by_type", "key", ["type"]), "entities.idx type")
}

async function setupRelations() {
  const COL = "relations"
  await safe(() => databases.createCollection(DB, COL, "Relations"), "create collection: relations")
  await safe(() => str(COL, "from_entity_id", 320, true), "relations.from_entity_id")
  await safe(() => str(COL, "to_entity_id", 320, true), "relations.to_entity_id")
  await safe(() => str(COL, "relation_type", 255, true), "relations.relation_type")
  await safe(() => str(COL, "source_knowledge_item_id", 320, false), "relations.source_knowledge_item_id")
  await safe(() => str(COL, "source", 255, false), "relations.source")
  await safe(() => idx(COL, "by_from", "key", ["from_entity_id"]), "relations.idx from_entity_id")
  await safe(() => idx(COL, "by_to", "key", ["to_entity_id"]), "relations.idx to_entity_id")
  await safe(() => idx(COL, "by_relation_type", "key", ["relation_type"]), "relations.idx relation_type")
}

async function setupWorkingMemory() {
  const COL = "working_memory"
  await safe(() => databases.createCollection(DB, COL, "Working Memory"), "create collection: working_memory")
  await safe(() => str(COL, "user_email", 320, true), "working_memory.user_email")
  await safe(() => str(COL, "content", 100000, true), "working_memory.content")
  await safe(() => str(COL, "source", 255, false), "working_memory.source")
  await safe(() => str(COL, "context", 100000, false), "working_memory.context")
  await safe(() => dt(COL, "expires_at", true), "working_memory.expires_at")
  await safe(() => str(COL, "promoted_to_knowledge_item_id", 320, false), "working_memory.promoted_to_knowledge_item_id")
  await safe(() => dt(COL, "created_at", true), "working_memory.created_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "working_memory.idx created_at")
  await safe(() => idx(COL, "by_user_email", "key", ["user_email"]), "working_memory.idx user_email")
  await safe(() => idx(COL, "by_expires_at", "key", ["expires_at"]), "working_memory.idx expires_at")
}

async function setupCustomLeadFields() {
  const COL = "custom_lead_fields"
  await safe(() => databases.createCollection(DB, COL, "Custom Lead Fields"), "create collection: custom_lead_fields")
  await safe(() => str(COL, "key", 255, true), "custom_lead_fields.key")
  await safe(() => str(COL, "label", 255, true), "custom_lead_fields.label")
  await safe(() => str(COL, "type", 255, true), "custom_lead_fields.type")
  await safe(() => str(COL, "options", 255, false, true), "custom_lead_fields.options[]")
  await safe(() => bool(COL, "required", true), "custom_lead_fields.required")
  await safe(() => bool(COL, "visible", true), "custom_lead_fields.visible")
  await safe(() => bool(COL, "sortable", true), "custom_lead_fields.sortable")
  await safe(() => bool(COL, "filterable", true), "custom_lead_fields.filterable")
  await safe(() => int(COL, "width", false), "custom_lead_fields.width")
  await safe(() => int(COL, "order", true), "custom_lead_fields.order")
  await safe(() => dt(COL, "created_at", true), "custom_lead_fields.created_at")
  await safe(() => dt(COL, "updated_at", true), "custom_lead_fields.updated_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "custom_lead_fields.idx created_at")
  await safe(() => idx(COL, "by_key", "unique", ["key"]), "custom_lead_fields.idx key (unique)")
  await safe(() => idx(COL, "by_order", "key", ["order"]), "custom_lead_fields.idx order")
}

async function setupLeadColumnConfigs() {
  const COL = "lead_column_configs"
  await safe(() => databases.createCollection(DB, COL, "Lead Column Configs"), "create collection: lead_column_configs")
  await safe(() => str(COL, "user_id", 320, true), "lead_column_configs.user_id")
  await safe(() => str(COL, "columns", 100000, false), "lead_column_configs.columns")
  await safe(() => dt(COL, "created_at", true), "lead_column_configs.created_at")
  await safe(() => dt(COL, "updated_at", true), "lead_column_configs.updated_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "lead_column_configs.idx created_at")
  await safe(() => idx(COL, "by_user_id", "unique", ["user_id"]), "lead_column_configs.idx user_id (unique)")
}

async function setupAuditLogs() {
  const COL = "audit_logs"
  await safe(() => databases.createCollection(DB, COL, "Audit Logs"), "create collection: audit_logs")
  await safe(() => str(COL, "table_name", 255, true), "audit_logs.table_name")
  await safe(() => str(COL, "record_id", 320, true), "audit_logs.record_id")
  await safe(() => str(COL, "action", 255, true), "audit_logs.action")
  await safe(() => str(COL, "diff", 100000, false), "audit_logs.diff")
  await safe(() => str(COL, "metadata", 100000, false), "audit_logs.metadata")
  await safe(() => str(COL, "actor_email", 320, false), "audit_logs.actor_email")
  await safe(() => str(COL, "actor_id", 320, false), "audit_logs.actor_id")
  await safe(() => str(COL, "ip", 255, false), "audit_logs.ip")
  await safe(() => str(COL, "user_agent", 100000, false), "audit_logs.user_agent")
  await safe(() => dt(COL, "created_at", true), "audit_logs.created_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "audit_logs.idx created_at")
  await safe(() => idx(COL, "by_table_name", "key", ["table_name"]), "audit_logs.idx table_name")
  await safe(() => idx(COL, "by_record_id", "key", ["record_id"]), "audit_logs.idx record_id")
  await safe(() => idx(COL, "by_actor_email", "key", ["actor_email"]), "audit_logs.idx actor_email")
}

async function main() {
  await safe(() => databases.create(DB, "Workspace"), "create database")
  await setupIntegrations()
  await setupMailAccounts()
  await setupEntities()
  await setupRelations()
  await setupWorkingMemory()
  await setupCustomLeadFields()
  await setupLeadColumnConfigs()
  await setupAuditLogs()
  console.log("\nDone.")
}

main()
