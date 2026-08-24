import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/supabase/server"

const JOB_API_URL = process.env.LEAD_JOB_API_URL ?? "https://leads.nasrullahtanim.me"
const JOB_API_SECRET = process.env.LEAD_JOB_API_SECRET ?? ""

export const dynamic = "force-dynamic"

/**
 * GET /api/lead-verification/jobs
 * Lists recent jobs (id, filename, created_at, status, counts) for history.
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!JOB_API_SECRET) {
    return NextResponse.json(
      { error: "Server misconfigured: LEAD_JOB_API_SECRET not set" },
      { status: 500 }
    )
  }

  try {
    const resp = await fetch(`${JOB_API_URL}/jobs`, {
      headers: { "x-job-secret": JOB_API_SECRET },
      cache: "no-store",
    })
    if (!resp.ok) {
      return NextResponse.json(
        { error: `Job API error: ${resp.status}` },
        { status: resp.status }
      )
    }
    return NextResponse.json(await resp.json())
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to reach job API: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    )
  }
}
