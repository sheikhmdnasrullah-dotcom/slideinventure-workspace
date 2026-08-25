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
    console.log("OK   ", label)
  } catch (e) {
    if (e.code === 409) console.log("EXISTS", label)
    else {
      console.log("FAIL ", label, "-", e.message)
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

async function setupBoards() {
  const COL = "boards"
  await safe(() => databases.createCollection(DB, COL, "Boards"), "create collection: boards")
  await safe(() => str(COL, "user_email", 320, true), "boards.user_email")
  await safe(() => str(COL, "title", 255, false), "boards.title")
  await safe(() => str(COL, "content", 100000, false), "boards.content")
  await safe(() => dt(COL, "created_at", true), "boards.created_at")
  await safe(() => dt(COL, "updated_at", true), "boards.updated_at")
  await safe(() => idx(COL, "by_user_email", "key", ["user_email"]), "boards.idx user_email")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "boards.idx created_at")
}

async function setupTerminalCommands() {
  const COL = "terminal_commands"
  await safe(() => databases.createCollection(DB, COL, "Terminal Commands"), "create collection: terminal_commands")
  await safe(() => str(COL, "command", 100000, true), "terminal_commands.command")
  await safe(() => str(COL, "cwd", 2000, false), "terminal_commands.cwd")
  await safe(() => int(COL, "exit_code", false), "terminal_commands.exit_code")
  await safe(() => str(COL, "stdout", 100000, false), "terminal_commands.stdout")
  await safe(() => str(COL, "stderr", 100000, false), "terminal_commands.stderr")
  await safe(() => int(COL, "duration_ms", false), "terminal_commands.duration_ms")
  await safe(() => str(COL, "triggered_by", 320, false), "terminal_commands.triggered_by")
  await safe(() => str(COL, "metadata", 100000, false), "terminal_commands.metadata")
  await safe(() => dt(COL, "created_at", true), "terminal_commands.created_at")
  await safe(() => str(COL, "title", 255, true), "terminal_commands.title")
  await safe(() => str(COL, "description", 100000, false), "terminal_commands.description")
  await safe(() => str(COL, "category", 255, false), "terminal_commands.category")
  await safe(() => str(COL, "tags", 255, false, true), "terminal_commands.tags[]")
  await safe(() => str(COL, "notes", 100000, false), "terminal_commands.notes")
  await safe(() => str(COL, "variables", 100000, false), "terminal_commands.variables")
  await safe(() => bool(COL, "favorite", false), "terminal_commands.favorite")
  await safe(() => dt(COL, "updated_at", true), "terminal_commands.updated_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "terminal_commands.idx created_at")
  await safe(() => idx(COL, "ft_title", "fulltext", ["title"]), "terminal_commands.ft title")
  await safe(() => idx(COL, "ft_command", "fulltext", ["command"]), "terminal_commands.ft command")
  await safe(() => idx(COL, "ft_description", "fulltext", ["description"]), "terminal_commands.ft description")
}

async function setupApps() {
  const COL = "apps"
  await safe(() => databases.createCollection(DB, COL, "Apps"), "create collection: apps")
  await safe(() => str(COL, "name", 255, true), "apps.name")
  await safe(() => str(COL, "slug", 255, true), "apps.slug")
  await safe(() => str(COL, "description", 100000, false), "apps.description")
  await safe(() => str(COL, "icon", 2000, false), "apps.icon")
  await safe(() => str(COL, "url", 2000, false), "apps.url")
  await safe(() => str(COL, "category", 255, false), "apps.category")
  await safe(() => bool(COL, "enabled", false), "apps.enabled")
  await safe(() => str(COL, "config", 100000, false), "apps.config")
  await safe(() => dt(COL, "created_at", true), "apps.created_at")
  await safe(() => dt(COL, "updated_at", true), "apps.updated_at")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "apps.idx created_at")
  await safe(() => idx(COL, "by_slug", "unique", ["slug"]), "apps.idx slug")
}

async function setupUsefulLinks() {
  const COL = "useful_links"
  await safe(() => databases.createCollection(DB, COL, "Useful Links"), "create collection: useful_links")
  await safe(() => str(COL, "title", 255, true), "useful_links.title")
  await safe(() => str(COL, "url", 2000, true), "useful_links.url")
  await safe(() => str(COL, "description", 100000, false), "useful_links.description")
  await safe(() => str(COL, "tags", 255, false, true), "useful_links.tags[]")
  await safe(() => str(COL, "favicon", 2000, false), "useful_links.favicon")
  await safe(() => str(COL, "created_by", 320, false), "useful_links.created_by")
  await safe(() => dt(COL, "created_at", true), "useful_links.created_at")
  await safe(() => dt(COL, "updated_at", true), "useful_links.updated_at")
  await safe(() => idx(COL, "by_created_by", "key", ["created_by"]), "useful_links.idx created_by")
  await safe(() => idx(COL, "by_created_at", "key", ["created_at"], ["DESC"]), "useful_links.idx created_at")
  await safe(() => idx(COL, "ft_title", "fulltext", ["title"]), "useful_links.ft title")
  await safe(() => idx(COL, "ft_url", "fulltext", ["url"]), "useful_links.ft url")
}

async function main() {
  await safe(() => databases.create(DB, "Workspace"), "create database")
  await setupBoards()
  await setupTerminalCommands()
  await setupApps()
  await setupUsefulLinks()
  console.log("\nDone.")
}

main()
