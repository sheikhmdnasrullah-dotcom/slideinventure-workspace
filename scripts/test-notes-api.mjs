import { Client, Users, ID } from "node-appwrite"

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)
const users = new Users(client)

const EMAIL = "notespoc@slidein.dev"
const PASS = "NotesPOC@2026!"
const cookie = `a_session_${process.env.APPWRITE_PROJECT_ID}`

const base = "http://localhost:3000/api/notes"

async function main() {
  const user = await users.create(ID.unique(), EMAIL, undefined, PASS, "Notes POC")
  const session = await users.createSession(user.$id)
  const authHeaders = { Cookie: `${cookie}=${session.secret}`, "Content-Type": "application/json" }

  const noAuth = await fetch(base)
  console.log("GET no-auth ->", noAuth.status, "(expect 401)")

  const listEmpty = await fetch(base, { headers: authHeaders })
  const listJson = await listEmpty.json()
  console.log("GET auth ->", listEmpty.status, "| notes:", listJson.notes?.length)

  const created = await fetch(base, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ title: "POC note", content: "[1,2,3]" }),
  })
  const createdJson = await created.json()
  const id = createdJson.note?.id
  console.log("POST ->", created.status, "| id:", id)

  const got = await fetch(`${base}/${id}`, { headers: authHeaders })
  console.log("GET by id ->", got.status)

  const listAfter = await fetch(base, { headers: authHeaders })
  const listAfterJson = await listAfter.json()
  console.log("GET list after create ->", listAfter.status, "| count:", listAfterJson.notes?.length)

  const del = await fetch(`${base}/${id}`, { method: "DELETE", headers: authHeaders })
  console.log("DELETE ->", del.status)

  await users.delete(user.$id)
  console.log("✅ cleaned up test user")
}

main().catch((e) => {
  console.error("❌", e.message)
  process.exit(1)
})
