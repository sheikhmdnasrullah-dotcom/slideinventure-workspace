import { NextRequest, NextResponse } from "next/server"
import { createEmailPasswordSession, SESSION_COOKIE } from "@/lib/appwrite/auth"

function getCookieDomain(host: string | null): string | undefined {
  if (!host) return undefined
  const h = host.split(":")[0]
  if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") return undefined
  return `.${h}`
}

export async function POST(request: NextRequest) {
  const { email, password } = await request.json().catch(() => ({} as Record<string, string>))
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  let session
  try {
    session = await createEmailPasswordSession(email, password)
  } catch {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }

  const domain = getCookieDomain(request.headers.get("host"))
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, session.secret, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    domain,
  })
  return res
}
