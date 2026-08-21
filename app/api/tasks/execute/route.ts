import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import { execAndRecord } from "@/lib/tasks/runner";
import { randomUUID } from "node:crypto";
import { after } from "next/server";

type TaskType = "script" | "research" | "cold_email" | "automation" | "system";

type TaskRunInput = {
  task_type: TaskType;
  command?: string;
  triggered_by?: string;
  knowledge_item_id?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const body = (await request.json()) as TaskRunInput;
  const id = randomUUID();

  try {
    await supabase.from("task_runs").insert({
      id,
      task_type: body.task_type,
      status: "running",
      command: body.command ?? null,
      triggered_by: body.triggered_by ?? null,
      knowledge_item_id: body.knowledge_item_id ?? null,
      metadata: body.metadata ?? {},
    });
  } catch {
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }

  // Only "script" rows are user-typed shell commands. "research"/"cold_email"
  // commands are free-text descriptions — executing those would be a command
  // injection vector, so they stay log-only.
  if (body.task_type === "script" && body.command) {
    after(() => execAndRecord(id, body.command!));
  }

  return Response.json({ id, status: "running" }, { status: 201 });
}
