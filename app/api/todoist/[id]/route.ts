import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { updateTask, completeTask, deleteTask } from "@/lib/todoist/client";
import { NextRequest } from "next/server";

const UpdateSchema = z.object({
  content: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  labels: z.array(z.string()).default([]),
  priority: z.number().int().min(1).max(4).optional(),
  dueDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid due date" })
    .optional()
    .nullable(),
  completed: z.boolean().optional(),
});

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  if (!id) {
    return ApiError.badRequest("VALIDATION_ERROR", "Task ID is required").toResponse();
  }

  try {
    await deleteTask(id);
    return Response.json({ id, status: "deleted" });
  } catch (error) {
    return ApiError.internal("TODOIST_ERROR", (error as Error).message).toResponse();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  if (!id) {
    return ApiError.badRequest("VALIDATION_ERROR", "Task ID is required").toResponse();
  }

  const body = await request.json().catch(() => ({}));

  try {
    if (body.complete === true) {
      await completeTask(id);
      return Response.json({ id, status: "completed" });
    }

    const validated = validate(UpdateSchema, body);
    const task = await updateTask(id, {
      content: validated.data.content,
      description: validated.data.description ?? undefined,
      project_id: validated.data.projectId ?? undefined,
      labels: validated.data.labels,
      priority: validated.data.priority,
      due_date: validated.data.dueDate ?? undefined,
      completed: validated.data.completed,
    });

    return Response.json({ id: task.id, status: "updated" });
  } catch (error) {
    return ApiError.internal("TODOIST_ERROR", (error as Error).message).toResponse();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  if (!id) {
    return ApiError.badRequest("VALIDATION_ERROR", "Task ID is required").toResponse();
  }

  const body = await request.json().catch(() => ({}));
  const validated = validate(UpdateSchema, body);

  try {
    const task = await updateTask(id, {
      content: validated.data.content,
      description: validated.data.description ?? undefined,
      project_id: validated.data.projectId ?? undefined,
      labels: validated.data.labels,
      priority: validated.data.priority,
      due_date: validated.data.dueDate ?? undefined,
      completed: validated.data.completed,
    });

    return Response.json({ id: task.id, status: "updated" });
  } catch (error) {
    return ApiError.internal("TODOIST_ERROR", (error as Error).message).toResponse();
  }
}
