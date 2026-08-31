import { NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { processAgentJob } from "@/lib/agents/worker";
import { listPendingAgentJobs } from "@/lib/agents/jobs-store";
import { listStaleEmailCrawlerBatches } from "@/lib/leads/email-crawler-batch";

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

  // Safety net for the YouTube email-crawler bulk batches: if the self-chaining
  // background worker missed a batch (e.g. its resume fetch failed), re-drive
  // any batch that's been stuck "running" past the stale threshold.
  const origin =
    process.env.APP_URL ||
    process.env.VERCEL_URL ||
    (request.nextUrl.origin !== "null" ? request.nextUrl.origin : "");
  let resumed = 0;
  if (origin) {
    const stale = await listStaleEmailCrawlerBatches();
    for (const id of stale) {
      waitUntil(
        fetch(`${origin.replace(/\/$/, "")}/api/email-crawler/batch/${id}/resume`, { method: "GET" }).catch(
          () => {}
        )
      );
      resumed++;
    }
  }

  return Response.json({ ok: true, processed: jobs.length, crawlerBatchesResumed: resumed });
}
