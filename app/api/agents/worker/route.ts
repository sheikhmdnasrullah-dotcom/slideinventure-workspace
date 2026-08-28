import { NextRequest } from "next/server";
import { processAgentJob } from "@/lib/agents/worker";
import { listPendingAgentJobs } from "@/lib/agents/jobs-store";

// Manual / scheduled fallback worker. Auth matches the project CRON_SECRET; if
// no secret is configured (local dev) it is open. Used to drive any jobs that
// didn't start via waitUntil (e.g. after a deploy or a function recycle).
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (jobId) {
    await processAgentJob(jobId);
    return Response.json({ ok: true, jobId });
  }

  const jobs = await listPendingAgentJobs(10);
  for (const job of jobs) {
    await processAgentJob(job.id);
  }
  return Response.json({ ok: true, processed: jobs.length });
}
