import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { execAndRecord } from "@/lib/tasks/runner";
import { after } from "next/server";
import { recordAudit } from "@/lib/api/audit";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.taskRuns;

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
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(TaskRunInputSchema, body);

  const id = ID.unique();
  const now = new Date().toISOString();

  try {
    await databases.createDocument(DB, COL, id, {
      task_type: validated.data.task_type,
      status: "running",
      command: validated.data.command ?? null,
      triggered_by: validated.data.triggered_by ?? null,
      knowledge_item_id: validated.data.knowledge_item_id ?? null,
      metadata: JSON.stringify(validated.data.metadata ?? {}),
      started_at: now,
    });
  } catch {
    return ApiError.internal("DB_ERROR", "Database unavailable").toResponse();
  }

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
