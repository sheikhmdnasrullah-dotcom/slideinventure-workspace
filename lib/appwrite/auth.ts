import "server-only"
import { cookies } from "next/headers"
import { Client, Account } from "node-appwrite"
import https from "node:https"

const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1"
const PROJECT = process.env.APPWRITE_PROJECT_ID || "6a8cf7090015800700cc"
export const SESSION_COOKIE = `a_session_${PROJECT}`

function sessionClient(secret: string) {
  return new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setSession(secret)
}

export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  const store = await cookies()
  const secret = store.get(SESSION_COOKIE)?.value
  if (!secret) {
    console.error("getSessionUser: no cookie found, cookie name:", SESSION_COOKIE)
    return null
  }
  console.error("getSessionUser: cookie found, length:", secret.length)
  try {
    const account = new Account(sessionClient(secret))
    const u = await account.get()
    console.error("getSessionUser: Appwrite account.get() succeeded, email:", u.email)
    return { id: u.$id, email: u.email ?? "" }
  } catch (e) {
    console.error("getSessionUser: Appwrite account.get() failed:", e)
    return null
  }
}

export async function createEmailPasswordSession(email: string, password: string): Promise<string> {
  const payload = JSON.stringify({ email, password })

  const url = new URL(`${ENDPOINT}/account/sessions/email`)
  const apiHeaders = {
    "X-Appwrite-Project": PROJECT,
    "content-type": "application/json",
    "accept": "application/json",
  }

  const session = await new Promise<string>((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: "POST",
        headers: apiHeaders,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on("data", (chunk) => chunks.push(chunk))
        res.on("end", () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error("Invalid email or password"))
          }

          const headers = res.headers as Record<string, unknown>
          const getHeader = (name: string) =>
            typeof headers.get === "function"
              ? (headers as any).get(name)
              : headers[name]

          const setCookieRaw = getHeader("set-cookie")
          const setCookie = Array.isArray(setCookieRaw)
            ? setCookieRaw
            : typeof setCookieRaw === "string"
              ? setCookieRaw.split(", ")
              : []

          const target = `a_session_${PROJECT}=`
          for (const c of setCookie) {
            if (c.startsWith(target)) {
              return resolve(c.slice(target.length).split(";")[0])
            }
          }

          const fallbackRaw = getHeader("x-fallback-cookies")
          if (typeof fallbackRaw === "string") {
            try {
              const parsed = JSON.parse(fallbackRaw) as Record<string, string>
              const val = parsed[`a_session_${PROJECT}`]
              if (val) return resolve(val)
            } catch {
              // ignore
            }
          }

          reject(new Error("No session cookie returned"))
        })
      }
    )

    req.on("error", reject)
    req.write(payload)
    req.end()
  })

  return session
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
