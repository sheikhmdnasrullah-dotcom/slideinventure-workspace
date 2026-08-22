import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { NextRequest } from "next/server";

const BulkSchema = z.object({
  action: z.enum(["delete", "update"]),
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(BulkSchema, body);

  const supabase = createServiceClient();

  if (validated.data.action === "delete") {
    const { error } = await supabase.from("leads").delete().in("id", validated.data.ids);

    if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();

    return Response.json({ deleted: validated.data.ids.length });
  }

  if (validated.data.action === "update") {
    const rest = body as Record<string, unknown>;
    const { error } = await supabase
      .from("leads")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .in("id", validated.data.ids);

    if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();

    return Response.json({ updated: validated.data.ids.length });
  }

  return ApiError.badRequest("UNSUPPORTED_ACTION", "Action must be 'delete' or 'update'").toResponse();
}
