import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery } from "@/lib/api/validation";
import { z } from "zod";
import { AuditLogSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  tableName: z.string().optional(),
  recordId: z.string().optional(),
  action: z.string().optional(),
  actorEmail: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return toJson(ApiError.unauthorized());

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return toJson(ApiError.rateLimited());

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);
  const supabase = createServiceClient();

  let q = supabase.from("audit_logs").select("*", { count: "exact" });

  if (query.data.tableName) q = q.eq("table_name", query.data.tableName);
  if (query.data.recordId) q = q.eq("record_id", query.data.recordId);
  if (query.data.action) q = q.eq("action", query.data.action);
  if (query.data.actorEmail) q = q.eq("actor_email", query.data.actorEmail);
  if (query.data.from) q = q.gte("created_at", query.data.from);
  if (query.data.to) q = q.lte("created_at", query.data.to);

  const from = (query.data.page - 1) * query.data.pageSize;
  const to = from + query.data.pageSize - 1;

  const { data, error, count } = await q.order("created_at", { ascending: false }).range(from, to);

  if (error) return toJson(ApiError.internal("DB_ERROR", error.message));

  return Response.json({
    data: (data ?? []) as Array<z.infer<typeof AuditLogSchema>>,
    total: count ?? 0,
    page: query.data.page,
    pageSize: query.data.pageSize,
  });
}
