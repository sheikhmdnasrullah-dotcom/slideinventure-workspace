import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery, validate } from "@/lib/api/validation";
import { z } from "zod";
import {
  listProjects,
  listLabels,
  listTasks,
  getTask,
  createTask,
  updateTask,
  completeTask,
  deleteTask,
} from "@/lib/todoist/client";
import { NextRequest } from "next/server";

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  projectId: z.string().optional(),
  label: z.string().optional(),
  completed: z.coerce.boolean().optional(),
});

const CreateSchema = z.object({
  content: z.string().min(1),
  description: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  labels: z.array(z.string()).default([]),
  priority: z.number().int().min(1).max(4).default(1),
  dueDate: z.string().datetime().optional().nullable(),
});

const UpdateSchema = z.object({
  content: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  labels: z.array(z.string()).default([]),
  priority: z.number().int().min(1).max(4).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  completed: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);

  try {
    const tasks = await listTasks({
      project_id: query.data.projectId,
      label: query.data.label,
      completed: query.data.completed,
    });

    const from = (query.data.page - 1) * query.data.pageSize;
    const to = from + query.data.pageSize - 1;
    const page = tasks.slice(from, to + 1);

    return Response.json({
      data: page,
      total: tasks.length,
      page: query.data.page,
      pageSize: query.data.pageSize,
    });
  } catch (error) {
    return ApiError.internal("TODOIST_ERROR", (error as Error).message).toResponse();
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(CreateSchema, body);

  try {
    const task = await createTask({
      content: validated.data.content,
      description: validated.data.description ?? undefined,
      project_id: validated.data.projectId ?? undefined,
      labels: validated.data.labels,
      priority: validated.data.priority,
      due_date: validated.data.dueDate ?? undefined,
    });

    return Response.json({ id: task.id }, { status: 201 });
  } catch (error) {
    return ApiError.internal("TODOIST_ERROR", (error as Error).message).toResponse();
  }
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean)
  const id = (segments[segments.length - 1] ?? "") as string

  if (!id || id === "api" || id === "todoist") {
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

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean)
  const id = (segments[segments.length - 1] ?? "") as string

  if (!id || id === "api" || id === "todoist") {
    return ApiError.badRequest("VALIDATION_ERROR", "Task ID is required").toResponse();
  }

  try {
    await deleteTask(id);
    return Response.json({ id, status: "deleted" });
  } catch (error) {
    return ApiError.internal("TODOIST_ERROR", (error as Error).message).toResponse();
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean)
  const id = (segments[segments.length - 1] ?? "") as string

  if (!id || id === "api" || id === "todoist") {
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
