import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { listLabels } from "@/lib/todoist/client";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const labels = await listLabels()
    return Response.json({ data: labels })
  } catch (error) {
    return ApiError.internal("TODOIST_ERROR", (error as Error).message).toResponse();
  }
}
