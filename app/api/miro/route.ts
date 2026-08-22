import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery, validate } from "@/lib/api/validation";
import { z } from "zod";
import { MiroActivitySchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  eventType: z.string().optional(),
  boardId: z.string().optional(),
});

const CreateSchema = MiroActivitySchema.omit({ id: true, createdAt: true });

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);
  const supabase = createServiceClient();

  let q = supabase.from("miro_activity").select("*", { count: "exact" });

  if (query.data.eventType) q = q.eq("event_type", query.data.eventType);
  if (query.data.boardId) q = q.eq("board_id", query.data.boardId);

  const from = (query.data.page - 1) * query.data.pageSize;
  const to = from + query.data.pageSize - 1;

  const { data, error, count } = await q.order("created_at", { ascending: false }).range(from, to);

  if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();

  return Response.json({
    data: data ?? [],
    total: count ?? 0,
    page: query.data.page,
    pageSize: query.data.pageSize,
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 50, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(CreateSchema, body);

  const supabase = createServiceClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error } = await supabase.from("miro_activity").insert({
    id,
    ...validated.data,
    created_at: now,
  });

  if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();

  return Response.json({ id }, { status: 201 });
}
