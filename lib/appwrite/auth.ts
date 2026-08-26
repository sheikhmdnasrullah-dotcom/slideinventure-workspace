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
  const payload = JSON.stringify({ email, password })
  const url = new URL(`${ENDPOINT}/account/sessions/email`)

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Appwrite-Project": PROJECT,
      "content-type": "application/json",
      "accept": "application/json",
      "content-length": String(Buffer.byteLength(payload)),
    },
    body: payload,
  })

  if (!res.ok) {
    throw new Error("Invalid email or password")
  }

  const setCookies =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
      : [res.headers.get("set-cookie") ?? ""]
  for (const c of setCookies) {
    if (c.trim().startsWith(`a_session_${PROJECT}=`)) {
      return c.trim().slice(`a_session_${PROJECT}=`.length).split(";")[0]
    }
  }

  const fallback = res.headers.get("x-fallback-cookies")
  if (fallback) {
    try {
      const parsed = JSON.parse(fallback) as Record<string, string>
      const val = parsed[`a_session_${PROJECT}`]
      if (val) return val
    } catch {
      // ignore
    }
  }

  throw new Error("No session cookie returned")
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
