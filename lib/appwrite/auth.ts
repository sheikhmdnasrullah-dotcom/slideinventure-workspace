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

export async function createEmailPasswordSession(email: string, password: string): Promise<string> {
  const res = await fetch(`${ENDPOINT}/account/sessions/email`, {
    method: "POST",
    headers: { "X-Appwrite-Project": PROJECT, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throw new Error("Invalid email or password")
  }

  const fallback = res.headers.get("x-fallback-cookies")
  if (fallback) {
    try {
      const parsed = JSON.parse(fallback) as Record<string, string>
      const key = `a_session_${PROJECT}`
      if (parsed[key]) return parsed[key]
    } catch {
      // ignore parse error and fall back to set-cookie parsing below
    }
  }

  const prefix = `a_session_${PROJECT}=`
  const setCookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie") || ""]
  const cookie = setCookies.find((c) => c.startsWith(prefix))
  if (!cookie) throw new Error("No session cookie returned")
  return cookie.slice(prefix.length).split(";")[0]
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
