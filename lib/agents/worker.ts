import "server-only";
import { enqueueAgentJob, getAgentJobById, updateAgentJob } from "@/lib/agents/jobs-store";
import type { AgentJobInput } from "@/lib/agents/jobs-store";
import { getAgentPrompt } from "@/lib/agents/roster";
import { agentRunStarted, agentRunCompleted, agentRunFailed } from "@/lib/agui/server";
import { captureResearchInsight } from "@/lib/brain/capture";

// Dispatches a queued agent job to the self-hosted Mastra server (VPS) and
// records the result, independent of any browser session. Triggered via
// waitUntil on enqueue, or lazily by the poll endpoint / cron. The job row in
// Appwrite is the source of truth, so a run can survive a function recycle or
// the user closing their laptop — the actual LLM/tool work happens on the
// Mastra box, not in this function. `mastra-client` is imported lazily so a
// failure there surfaces as a job error rather than taking down the route.
export async function processAgentJob(jobId: string): Promise<void> {
  const job = await getAgentJobById(jobId);
  if (!job) return;
  if (job.status === "done" || job.status === "error") return;
  if (job.status === "running") return; // already in flight elsewhere

  await updateAgentJob(jobId, { status: "running" });

  const persona = getAgentPrompt(job.slug);
  const ctx = { runId: jobId, agent: persona?.name ?? job.slug, userEmail: job.owner };
  await agentRunStarted(ctx, job.message.slice(0, 200));

  try {
    const { runMastraAgent } = await import("@/lib/agents/mastra-client");
    const res = await runMastraAgent({
      slug: job.slug,
      message: job.message,
      history: job.history ?? [],
      userEmail: job.owner,
    });
    if (!res.ok) {
      await updateAgentJob(jobId, { status: "error", error: res.error || "Agent run failed" });
      await agentRunFailed(ctx, res.error || "Agent run failed");
    } else {
      await updateAgentJob(jobId, { status: "done", answer: res.answer });
      await agentRunCompleted(ctx, res.answer.slice(0, 280));
      // The background run's result gets its core idea captured to the
      // Research Lab, same as a chat-run agent answer.
      captureResearchInsight({
        userEmail: job.owner,
        source: "agent",
        sourceRef: jobId,
        title: `${ctx.agent}: ${job.message.slice(0, 80)}`,
        rawText: `Task: ${job.message}\n\nResult: ${res.answer}`,
        reference: { tab: "agents", slug: job.slug },
      }).catch(() => {});
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Agent run failed";
    await updateAgentJob(jobId, { status: "error", error: message });
    await agentRunFailed(ctx, message);
  }
}

export async function enqueueAndProcess(input: AgentJobInput): Promise<{ id: string }> {
  const job = await enqueueAgentJob(input);
  return { id: job.id };
}
