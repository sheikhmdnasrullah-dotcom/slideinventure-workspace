import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { NextRequest } from "next/server";

export async function GET(_request: NextRequest) {
  const user = await getSessionUser();
  if (!user?.email) return toJson(ApiError.unauthorized());

  const limit = checkRateLimit(_request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return toJson(ApiError.rateLimited());

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("knowledge_search_history")
    .select("id, query, mode, result_count, created_at")
    .eq("user_email", user.email)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return toJson(ApiError.internal("DB_ERROR", error.message));
  return Response.json(data ?? []);
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user?.email) return toJson(ApiError.unauthorized());

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return toJson(ApiError.rateLimited());

  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  let query = supabase.from("knowledge_search_history").delete().eq("user_email", user.email);
  if (id) query = query.eq("id", id);

  const { error } = await query;
  if (error) return toJson(ApiError.internal("DB_ERROR", error.message));

  return Response.json({ status: "deleted" });
}
