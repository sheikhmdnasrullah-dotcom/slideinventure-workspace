import { readFileSync, writeFileSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { Client, Users, ID } from "node-appwrite"

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)
const users = new Users(client)

const raw = JSON.parse(readFileSync("/tmp/users.json", "utf8"))
const out = {}

for (const u of raw) {
  const temp = "Chang3me!" + randomBytes(3).toString("hex")
  const id = ID.unique()
  try {
    const created = await users.create(id, u.email, undefined, temp, u.name || u.email)
    out[u.email] = temp
    console.log(`imported ${u.email} -> Appwrite user ${created.$id}`)
  } catch (e) {
    if (e.code === 409) console.log(`already exists: ${u.email}`)
    else {
      console.log(`FAILED ${u.email}: ${e.message}`)
      out[u.email] = "(import failed)"
    }
  }
}

writeFileSync("/tmp/appwrite-temp-passwords.txt", JSON.stringify(out, null, 2))
console.log("\nTemp passwords written to /tmp/appwrite-temp-passwords.txt")
