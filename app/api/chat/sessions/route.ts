import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("id, title, updated_at")
    .eq("user_email", user.email!)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();
  return Response.json(data ?? []);
}
