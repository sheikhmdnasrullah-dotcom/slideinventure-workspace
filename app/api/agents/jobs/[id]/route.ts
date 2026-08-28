import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { getAgentJob } from "@/lib/agents/jobs-store";
import { processAgentJob } from "@/lib/agents/worker";

// Poll endpoint for a queued agent job. While a client is watching, a still
// pending job is driven forward here as a fallback to waitUntil (covers the
// case where the initial trigger didn't fire). Returns the latest status so the
// UI can show progress and the final answer.
export const maxDuration = 300;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  const owner = user.email || user.id;

  const job = await getAgentJob(id, owner);
  if (!job) return ApiError.notFound("JOB_NOT_FOUND", "Job not found").toResponse();

  if (job.status === "pending") {
    await processAgentJob(id);
  }

  const updated = await getAgentJob(id, owner);
  if (!updated) return ApiError.notFound("JOB_NOT_FOUND", "Job not found").toResponse();

  return Response.json({
    id: updated.id,
    status: updated.status,
    answer: updated.answer,
    error: updated.error,
  });
}
