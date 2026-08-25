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

async function setupMiroActivity() {
  const COL = "miro_activity"
  await safe(() => databases.createCollection(DB, COL, "Miro Activity"), "create collection: miro_activity")
  await safe(() => str(COL, "event_type", 255, true), "miro.event_type")
  await safe(() => str(COL, "board_id", 255, false), "miro.board_id")
  await safe(() => str(COL, "card_id", 255, false), "miro.card_id")
  await safe(() => str(COL, "user_id", 255, false), "miro.user_id")
  await safe(() => str(COL, "user_name", 255, false), "miro.user_name")
  await safe(() => str(COL, "action", 255, false), "miro.action")
  await safe(() => str(COL, "metadata", 100000, true), "miro.metadata")
  await safe(() => dt(COL, "created_at", true), "miro.created_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "miro.idx created_at")
  await safe(() => idx(COL, "by_user_id", "key", ["user_id"]), "miro.idx user_id")
  await safe(() => idx(COL, "by_event_type", "key", ["event_type"]), "miro.idx event_type")
}

async function setupNotionActivity() {
  const COL = "notion_activity"
  await safe(() => databases.createCollection(DB, COL, "Notion Activity"), "create collection: notion_activity")
  await safe(() => str(COL, "event_type", 255, true), "notion.event_type")
  await safe(() => str(COL, "page_id", 255, false), "notion.page_id")
  await safe(() => str(COL, "block_id", 255, false), "notion.block_id")
  await safe(() => str(COL, "user_id", 255, false), "notion.user_id")
  await safe(() => str(COL, "user_name", 255, false), "notion.user_name")
  await safe(() => str(COL, "action", 255, false), "notion.action")
  await safe(() => str(COL, "metadata", 100000, true), "notion.metadata")
  await safe(() => dt(COL, "created_at", true), "notion.created_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "notion.idx created_at")
  await safe(() => idx(COL, "by_user_id", "key", ["user_id"]), "notion.idx user_id")
  await safe(() => idx(COL, "by_event_type", "key", ["event_type"]), "notion.idx event_type")
}

async function setupTodoistTasks() {
  const COL = "todoist_tasks"
  await safe(() => databases.createCollection(DB, COL, "Todoist Tasks"), "create collection: todoist_tasks")
  await safe(() => str(COL, "external_id", 255, false), "todoist.external_id")
  await safe(() => str(COL, "project_id", 255, false), "todoist.project_id")
  await safe(() => str(COL, "content", 100000, true), "todoist.content")
  await safe(() => str(COL, "description", 100000, false), "todoist.description")
  await safe(() => int(COL, "priority", true), "todoist.priority")
  await safe(() => dt(COL, "due_date", false), "todoist.due_date")
  await safe(() => bool(COL, "completed", true), "todoist.completed")
  await safe(() => str(COL, "assignee", 255, false), "todoist.assignee")
  await safe(() => str(COL, "metadata", 100000, true), "todoist.metadata")
  await safe(() => dt(COL, "created_at", true), "todoist.created_at")
  await safe(() => dt(COL, "updated_at", true), "todoist.updated_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "todoist.idx created_at")
  await safe(() => idx(COL, "by_completed", "key", ["completed"]), "todoist.idx completed")
  await safe(() => idx(COL, "by_project_id", "key", ["project_id"]), "todoist.idx project_id")
}

async function setupTaskRuns() {
  const COL = "task_runs"
  await safe(() => databases.createCollection(DB, COL, "Task Runs"), "create collection: task_runs")
  await safe(() => str(COL, "task_type", 255, true), "task_runs.task_type")
  await safe(() => str(COL, "status", 255, true), "task_runs.status")
  await safe(() => str(COL, "command", 100000, false), "task_runs.command")
  await safe(() => str(COL, "output", 100000, false), "task_runs.output")
  await safe(() => int(COL, "exit_code", false), "task_runs.exit_code")
  await safe(() => dt(COL, "started_at", true), "task_runs.started_at")
  await safe(() => dt(COL, "completed_at", false), "task_runs.completed_at")
  await safe(() => str(COL, "triggered_by", 255, false), "task_runs.triggered_by")
  await safe(() => str(COL, "knowledge_item_id", 255, false), "task_runs.knowledge_item_id")
  await safe(() => str(COL, "metadata", 100000, false), "task_runs.metadata")
  await safe(() => idx(COL, "by_started_at", "key", ["started_at"], ["DESC"]), "task_runs.idx started_at")
  await safe(() => idx(COL, "by_status", "key", ["status"]), "task_runs.idx status")
  await safe(() => idx(COL, "by_task_type", "key", ["task_type"]), "task_runs.idx task_type")
}

async function setupTaskRunEvents() {
  const COL = "task_run_events"
  await safe(() => databases.createCollection(DB, COL, "Task Run Events"), "create collection: task_run_events")
  await safe(() => str(COL, "task_run_id", 255, true), "task_run_events.task_run_id")
  await safe(() => int(COL, "sequence", true), "task_run_events.sequence")
  await safe(() => int(COL, "current", true), "task_run_events.current")
  await safe(() => int(COL, "total", true), "task_run_events.total")
  await safe(() => str(COL, "current_item", 100000, false), "task_run_events.current_item")
  await safe(() => str(COL, "status", 255, false), "task_run_events.status")
  await safe(() => str(COL, "metadata", 100000, true), "task_run_events.metadata")
  await safe(() => dt(COL, "created_at", true), "task_run_events.created_at")
  await safe(() => idx(COL, "by_run_seq", "key", ["task_run_id", "sequence"], ["ASC", "ASC"]), "task_run_events.idx run_seq")
  await safe(() => idx(COL, "by_run_created", "key", ["task_run_id", "created_at"], ["ASC", "DESC"]), "task_run_events.idx run_created")
}

async function setupVerificationJobs() {
  const COL = "verification_jobs"
  await safe(() => databases.createCollection(DB, COL, "Verification Jobs"), "create collection: verification_jobs")
  await safe(() => str(COL, "status", 255, true), "verification_jobs.status")
  await safe(() => int(COL, "total_leads", false), "verification_jobs.total_leads")
  await safe(() => int(COL, "checked_count", true), "verification_jobs.checked_count")
  await safe(() => str(COL, "verdict_counts", 100000, true), "verification_jobs.verdict_counts")
  await safe(() => str(COL, "result_file_path", 2000, false), "verification_jobs.result_file_path")
  await safe(() => str(COL, "error_message", 100000, false), "verification_jobs.error_message")
  await safe(() => str(COL, "job_id", 255, false), "verification_jobs.job_id")
  await safe(() => dt(COL, "created_at", false), "verification_jobs.created_at")
  await safe(() => dt(COL, "updated_at", false), "verification_jobs.updated_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "verification_jobs.idx created_at")
  await safe(() => idx(COL, "by_status", "key", ["status"]), "verification_jobs.idx status")
}

async function main() {
  await safe(() => databases.create(DB, "Workspace"), "create database")
  await setupMiroActivity()
  await setupNotionActivity()
  await setupTodoistTasks()
  await setupTaskRuns()
  await setupTaskRunEvents()
  await setupVerificationJobs()
  console.log("\nDone.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
