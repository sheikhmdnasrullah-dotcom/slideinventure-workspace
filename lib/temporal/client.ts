import "server-only";
import { Connection, WorkflowClient } from "@temporalio/client";

// Temporal is optional infrastructure. When TEMPORAL_ADDRESS is unset (e.g.
// local dev), startAgentWorkflow() degrades to a no-op signal so the rest of
// the app keeps using the existing task_runs runner. On the VPS, point
// TEMPORAL_ADDRESS at a self-hosted server (or Temporal Cloud) and run
// server/temporal-worker.ts to enable durable orchestration.

let clientPromise: Promise<WorkflowClient> | null = null;

export function temporalEnabled(): boolean {
  return Boolean(process.env.TEMPORAL_ADDRESS);
}

async function getClient(): Promise<WorkflowClient | null> {
  if (!temporalEnabled()) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const conn = await Connection.connect({
          address: process.env.TEMPORAL_ADDRESS as string,
          namespace: process.env.TEMPORAL_NAMESPACE || "default",
        });
        return new WorkflowClient({ connection: conn });
      } catch (e) {
        clientPromise = null;
        throw e;
      }
    })();
  }
  return clientPromise;
}

export type StartWorkflowInput = {
  task: string;
  startUrl?: string;
  userEmail?: string;
  workflowId?: string;
};

export async function startAgentWorkflow(
  input: StartWorkflowInput
): Promise<{ scheduled: boolean; workflowId?: string; reason?: string }> {
  const client = await getClient().catch(() => null);
  if (!client) return { scheduled: false, reason: "Temporal not configured or unreachable" };

  const workflowId = input.workflowId || `agent-${Date.now()}`;
  const handle = await client.start("runAgentTask", {
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || "workspace-tasks",
    workflowId,
    args: [input],
  });
  return { scheduled: true, workflowId: handle.workflowId };
}
