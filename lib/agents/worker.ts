import "server-only";
import { enqueueAgentJob, getAgentJobById, updateAgentJob } from "@/lib/agents/jobs-store";
import type { AgentJobInput } from "@/lib/agents/jobs-store";

// Executes a queued agent job on the server, independent of any browser session.
// Triggered via waitUntil on enqueue, or lazily by the poll endpoint / cron. The
// job row in Appwrite is the source of truth, so a run can survive a function
// recycle or the user closing their laptop. `mastra` is imported lazily so a
// failure there surfaces as a job error rather than taking down the route.
export async function processAgentJob(jobId: string): Promise<void> {
  const job = await getAgentJobById(jobId);
  if (!job) return;
  if (job.status === "done" || job.status === "error") return;
  if (job.status === "running") return; // already in flight elsewhere

  await updateAgentJob(jobId, { status: "running" });
  try {
    const { runMastraAgent } = await import("@/lib/agents/mastra");
    const res = await runMastraAgent({
      slug: job.slug,
      message: job.message,
      history: job.history ?? [],
      userEmail: job.owner,
    });
    if (!res.ok) {
      await updateAgentJob(jobId, { status: "error", error: res.error || "Agent run failed" });
    } else {
      await updateAgentJob(jobId, { status: "done", answer: res.answer });
    }
  } catch (e) {
    await updateAgentJob(jobId, {
      status: "error",
      error: e instanceof Error ? e.message : "Agent run failed",
    });
  }
}

export async function enqueueAndProcess(input: AgentJobInput): Promise<{ id: string }> {
  const job = await enqueueAgentJob(input);
  return { id: job.id };
}
