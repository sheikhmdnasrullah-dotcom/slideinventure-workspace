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
  let data: unknown[] = [];

  try {
    const result = await supabase
      .from("task_runs")
      .select("id, task_type, status, command, exit_code, started_at, completed_at, triggered_by, knowledge_item_id")
      .order("started_at", { ascending: false })
      .limit(100);
    data = result.data ?? [];
  } catch {
    // Supabase unreachable; return empty list
  }

  return Response.json(data);
}
