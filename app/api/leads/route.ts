import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery, validate } from "@/lib/api/validation";
import { z } from "zod";
import { LeadSchema, type Lead } from "@/lib/api/schemas";
import { recordAudit } from "@/lib/api/audit";
import { NextRequest } from "next/server";

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
});

const CreateSchema = LeadSchema.omit({ id: true, createdAt: true, updatedAt: true });

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited("RATE_LIMITED", "Too many requests", Math.ceil(limit.resetAt / 1000)).toResponse();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);
  const supabase = createServiceClient();

  let q = supabase.from("leads").select("*", { count: "exact" });

  if (query.data.search) {
    q = q.or(
      `first_name.ilike.%${query.data.search}%,last_name.ilike.%${query.data.search}%,email.ilike.%${query.data.search}%,company.ilike.%${query.data.search}%`
    );
  }
  if (query.data.status) {
    q = q.eq("status", query.data.status);
  }
  if (query.data.source) {
    q = q.eq("source", query.data.source);
  }

  const from = (query.data.page - 1) * query.data.pageSize;
  const to = from + query.data.pageSize - 1;

  const { data, error, count } = await q
    .order(query.data.sortBy, { ascending: query.data.sortOrder === "asc" })
    .range(from, to);

  if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();

  return Response.json({
    data: (data ?? []) as Lead[],
    total: count ?? 0,
    page: query.data.page,
    pageSize: query.data.pageSize,
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(CreateSchema, body);

  const supabase = createServiceClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error } = await supabase.from("leads").upsert({
    id,
    ...validated.data,
    updated_at: now,
    created_at: now,
  });

  if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();

  await recordAudit({
    table: "leads",
    recordId: id,
    action: "insert",
    diff: validated.data,
    actor: { userEmail: user.email ?? undefined, userId: user.id },
  });

  return Response.json({ id, status: "created" }, { status: 201 });
}
