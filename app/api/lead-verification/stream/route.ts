import { NextRequest } from "next/server"
import { getSessionUser } from "@/lib/appwrite/auth"

const JOB_API_URL = process.env.LEAD_JOB_API_URL ?? "https://leads.nasrullahtanim.me"
const JOB_API_SECRET = process.env.LEAD_JOB_API_SECRET ?? ""

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/lead-verification/stream?jobId=<uuid>
 * Streams SSE events from the VPS job API to the browser. The x-job-secret
 * header is injected server-side and never reaches the browser; the user
 * session cookie authenticates this hop.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  if (!JOB_API_SECRET) {
    return new Response("Server misconfigured: LEAD_JOB_API_SECRET not set", {
      status: 500,
    })
  }

  const jobId = request.nextUrl.searchParams.get("jobId")
  if (!jobId) {
    return new Response("Missing jobId query param", { status: 400 })
  }

  const upstream = await fetch(`${JOB_API_URL}/jobs/${jobId}/stream`, {
    headers: { "x-job-secret": JOB_API_SECRET },
    cache: "no-store",
  })

  if (!upstream.ok || !upstream.body) {
    return new Response(`Job API error: ${upstream.status}`, { status: 502 })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
