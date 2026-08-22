import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery, validate } from "@/lib/api/validation";
import { z } from "zod";
import { TerminalCommandSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  favorite: z.coerce.boolean().optional(),
});

const CreateSchema = TerminalCommandSchema.omit({ id: true, createdAt: true, updatedAt: true });

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return toJson(ApiError.unauthorized());

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return toJson(ApiError.rateLimited());

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);
  const supabase = createServiceClient();

  let q = supabase.from("terminal_commands").select("*", { count: "exact" });

  if (query.data.search) {
    q = q.or(
      `title.ilike.%${query.data.search}%,command.ilike.%${query.data.search}%,description.ilike.%${query.data.search}%`
    );
  }
  if (query.data.category) {
    q = q.eq("category", query.data.category);
  }
  if (query.data.favorite !== undefined) {
    q = q.eq("favorite", query.data.favorite);
  }

  const from = (query.data.page - 1) * query.data.pageSize;
  const to = from + query.data.pageSize - 1;

  const { data, error, count } = await q.order("created_at", { ascending: false }).range(from, to);

  if (error) return toJson(ApiError.internal("DB_ERROR", error.message));

  return Response.json({
    data: data ?? [],
    total: count ?? 0,
    page: query.data.page,
    pageSize: query.data.pageSize,
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return toJson(ApiError.unauthorized());

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return toJson(ApiError.rateLimited());

  const body = await request.json().catch(() => ({}));
  const validated = validate(CreateSchema, body);

  const supabase = createServiceClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { triggeredBy, exitCode, durationMs, ...rest } = validated.data;

  const { error } = await supabase.from("terminal_commands").insert({
    id,
    ...rest,
    triggered_by: user.email ?? triggeredBy ?? null,
    exit_code: exitCode ?? null,
    duration_ms: durationMs ?? null,
    created_at: now,
    updated_at: now,
  });

  if (error) return toJson(ApiError.internal("DB_ERROR", error.message));

  return Response.json({ id }, { status: 201 });
}
