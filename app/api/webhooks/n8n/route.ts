import { createServiceClient } from "@/lib/supabase/server";
import { verifyInternalSecret } from "@/lib/auth/verify-internal-secret";
import { randomUUID } from "node:crypto";

export async function POST(request: Request) {
  if (!verifyInternalSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const payload = await request.json().catch(() => ({}));

  const workflow = (payload as { workflow?: { id?: string; name?: string } }).workflow;
  const status = (payload as { status?: string }).status ?? "unknown";
  const runId = (payload as { runId?: string }).runId ?? randomUUID();

  try {
    await supabase.from("task_runs").insert({
      id: runId,
      task_type: "automation",
      status: status === "success" ? "completed" : status === "error" ? "failed" : "running",
      command: workflow?.name ?? "n8n-webhook",
      output: JSON.stringify(payload),
      completed_at: new Date().toISOString(),
      metadata: {
        workflow_id: workflow?.id ?? null,
        workflow_name: workflow?.name ?? null,
        source: "n8n",
      },
    });
  } catch {
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }

  return Response.json({ id: runId, status: "accepted" }, { status: 202 });
}
