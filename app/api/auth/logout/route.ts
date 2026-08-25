import { NextRequest, NextResponse } from "next/server"
import { deleteCurrentSession, SESSION_COOKIE } from "@/lib/appwrite/auth"

export async function POST(request: NextRequest) {
  await deleteCurrentSession()
  const host = request.nextUrl.hostname
  const isLocalhost =
    host === "localhost" || host === "127.0.0.1" || host === "::1"
  const secure = request.nextUrl.protocol === "https:" || isLocalhost
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure,
    maxAge: 0,
  })
  return res
}
