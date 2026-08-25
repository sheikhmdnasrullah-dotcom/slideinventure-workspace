import { NextRequest, NextResponse } from "next/server"
import { createEmailPasswordSession, SESSION_COOKIE } from "@/lib/appwrite/auth"

export async function POST(request: NextRequest) {
  const { email, password } = await request.json().catch(() => ({} as Record<string, string>))
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  let token
  try {
    token = await createEmailPasswordSession(email, password)
  } catch {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
  return res
}
