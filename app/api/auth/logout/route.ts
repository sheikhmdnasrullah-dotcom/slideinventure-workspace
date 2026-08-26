import { NextRequest, NextResponse } from "next/server"
import { deleteCurrentSession, SESSION_COOKIE } from "@/lib/appwrite/auth"
import { sessionCookieOptions } from "@/lib/appwrite/session-cookie"

export async function POST(request: NextRequest) {
  await deleteCurrentSession()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(request),
    maxAge: 0,
  })
  return res
}
