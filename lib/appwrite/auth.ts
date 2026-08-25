import "server-only"
import { cookies } from "next/headers"
import { Client, Account } from "node-appwrite"

const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1"
const PROJECT = process.env.APPWRITE_PROJECT_ID || "6a8cf7090015800700cc"
export const SESSION_COOKIE = `a_session_${PROJECT}`

function sessionClient(secret: string) {
  return new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setSession(secret)
}

export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  const store = await cookies()
  const secret = store.get(SESSION_COOKIE)?.value
  if (!secret) return null
  try {
    const account = new Account(sessionClient(secret))
    const u = await account.get()
    return { id: u.$id, email: u.email ?? "" }
  } catch {
    return null
  }
}

export async function createEmailPasswordSession(email: string, password: string) {
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT)
  const account = new Account(client)
  return account.createEmailPasswordSession(email, password)
}

export async function deleteCurrentSession() {
  const store = await cookies()
  const secret = store.get(SESSION_COOKIE)?.value
  if (!secret) return
  try {
    const account = new Account(sessionClient(secret))
    await account.deleteSession("current")
  } catch {
    /* ignore */
  }
}
