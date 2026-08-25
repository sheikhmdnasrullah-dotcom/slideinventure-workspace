import { NextRequest, NextResponse } from "next/server"
import { Client, Users, Account, ID } from "node-appwrite"
import { SESSION_COOKIE } from "@/lib/appwrite/auth"

const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1"
const PROJECT = process.env.APPWRITE_PROJECT_ID || "6a8cf7090015800700cc"
const API_KEY = process.env.APPWRITE_API_KEY

function getCookieDomain(host: string | null): string | undefined {
  if (!host) return undefined
  const h = host.split(":")[0]
  if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") return undefined
  return `.${h}`
}

export async function POST(request: NextRequest) {
  const { email, password, name } = await request.json().catch(() => ({}) as Record<string, string>)
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY || "")
  const users = new Users(client)
  const account = new Account(client)

  try {
    const user = await users.create(ID.unique(), email, password, name || "")
    const session = await account.createEmailPasswordSession(email, password)

    const domain = getCookieDomain(request.headers.get("host"))
    const res = NextResponse.json({ ok: true, user: { id: user.$id, email: user.email, name: user.name } })
    res.cookies.set(SESSION_COOKIE, session.secret, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      domain,
    })
    return res
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signup failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
