import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery } from "@/lib/api/validation";
import { z } from "zod";
import { NextRequest } from "next/server";

const ListSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
});

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, evidence, filters, created_at")
    .eq("session_id", query.data.sessionId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();
  return Response.json(data ?? []);
}
