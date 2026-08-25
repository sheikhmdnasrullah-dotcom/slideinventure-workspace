import { Client, Databases, ID, Query } from "node-appwrite"

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1")
  .setProject(process.env.APPWRITE_PROJECT_ID || "6a8cf7090015800700cc")
  .setKey(process.env.APPWRITE_API_KEY || "dummy-build-key")

const databases = new Databases(client)
const DB = process.env.APPWRITE_DATABASE_ID
const COL = "notes"
const EMAIL = "test@slidein.dev"

async function main() {
  const created = await databases.createDocument(DB, COL, ID.unique(), {
    user_email: EMAIL,
    title: "POC note",
    content: JSON.stringify([{ type: "paragraph", content: "hello" }]),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  console.log("✅ created:", created.$id)

  const list = await databases.listDocuments(DB, COL, [Query.equal("user_email", EMAIL)])
  console.log("✅ listed for user:", list.total, "doc(s)")

  const updated = await databases.updateDocument(DB, COL, created.$id, {
    title: "POC note (edited)",
    updated_at: new Date().toISOString(),
  })
  console.log("✅ updated title:", updated.title)

  await databases.deleteDocument(DB, COL, created.$id)
  console.log("✅ deleted")
}

main().catch((e) => {
  console.error("❌", e.message)
  process.exit(1)
})
