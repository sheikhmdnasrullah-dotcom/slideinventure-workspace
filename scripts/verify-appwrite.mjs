import { Client, Databases, Users, Storage } from "node-appwrite"

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1")
  .setProject(process.env.APPWRITE_PROJECT_ID || "6a8cf7090015800700cc")
  .setKey(process.env.APPWRITE_API_KEY || "dummy-build-key")

const databases = new Databases(client)
const users = new Users(client)
const storage = new Storage(client)

async function main() {
  try {
    const db = await databases.list()
    console.log("✅ databases scope OK — databases found:", db.total)
  } catch (e) {
    console.log("❌ databases:", e.message)
  }
  try {
    const u = await users.list()
    console.log("✅ users scope OK — users found:", u.total)
  } catch (e) {
    console.log("❌ users:", e.message)
  }
  try {
    const b = await storage.listBuckets()
    console.log("✅ storage scope OK — buckets found:", b.total)
  } catch (e) {
    console.log("❌ storage:", e.message)
  }
}

main()
