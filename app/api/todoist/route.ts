import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery, validate } from "@/lib/api/validation";
import { z } from "zod";
import { TodoistTaskSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  projectId: z.string().optional(),
  completed: z.coerce.boolean().optional(),
  assignee: z.string().optional(),
});

const CreateSchema = TodoistTaskSchema.omit({ id: true, createdAt: true, updatedAt: true });

export async function GET(request: NextRequest) {
  const user = getSessionUser();
  if (!user) return ApiError.unauthorized();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);
  const supabase = createServiceClient();

  let q = supabase.from("todoist_tasks").select("*", { count: "exact" });

  if (query.data.projectId) q = q.eq("project_id", query.data.projectId);
  if (query.data.completed !== undefined) q = q.eq("completed", query.data.completed);
  if (query.data.assignee) q = q.eq("assignee", query.data.assignee);

  const from = (query.data.page - 1) * query.data.pageSize;
  const to = from + query.data.pageSize - 1;

  const { data, error, count } = await q.order("created_at", { ascending: false }).range(from, to);

  if (error) return ApiError.internal("DB_ERROR", error.message);

  return Response.json({
    data: data ?? [],
    total: count ?? 0,
    page: query.data.page,
    pageSize: query.data.pageSize,
  });
}

export async function POST(request: NextRequest) {
  const user = getSessionUser();
  if (!user) return ApiError.unauthorized();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited();

  const body = await request.json().catch(() => ({}));
  const validated = validate(CreateSchema, body);

  const supabase = createServiceClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error } = await supabase.from("todoist_tasks").insert({
    id,
    ...validated.data,
    assignee: user.email ?? validated.data.assignee ?? null,
    created_at: now,
    updated_at: now,
  });

  if (error) return ApiError.internal("DB_ERROR", error.message);

  return Response.json({ id }, { status: 201 });
}
