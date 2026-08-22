import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { execAndRecord } from "@/lib/tasks/runner";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { recordAudit } from "@/lib/api/audit";

type TaskType = "script" | "research" | "cold_email" | "automation" | "system";

const TaskRunInputSchema = z.object({
  task_type: z.enum(["script", "research", "cold_email", "automation", "system"]),
  command: z.string().optional(),
  triggered_by: z.string().optional(),
  knowledge_item_id: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return toJson(ApiError.unauthorized());

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return toJson(ApiError.rateLimited());

  const body = await request.json().catch(() => ({}));
  const validated = validate(TaskRunInputSchema, body);

  const supabase = createServiceClient();
  const id = randomUUID();
  const now = new Date().toISOString();

  const { error } = await supabase.from("task_runs").insert({
    id,
    task_type: validated.data.task_type,
    status: "running",
    command: validated.data.command ?? null,
    triggered_by: validated.data.triggered_by ?? null,
    knowledge_item_id: validated.data.knowledge_item_id ?? null,
    metadata: validated.data.metadata ?? {},
    started_at: now,
  });

  if (error) return toJson(ApiError.internal("DB_ERROR", "Database unavailable"));

  await recordAudit({
    table: "task_runs",
    recordId: id,
    action: "insert",
    metadata: { task_type: validated.data.task_type, command: validated.data.command },
    actor: { userEmail: user.email ?? undefined, userId: user.id },
  });

  if (validated.data.task_type === "script" && validated.data.command) {
    after(() => execAndRecord(id, validated.data.command!));
  }

  return Response.json({ id, status: "running" }, { status: 201 });
}
