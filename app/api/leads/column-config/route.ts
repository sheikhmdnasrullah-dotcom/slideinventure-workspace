import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { LeadColumnConfigSchema, DEFAULT_COLUMNS } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const ColumnSchema = z.object({
  columns: z.array(LeadColumnConfigSchema),
});

export async function GET() {
  const user = getSessionUser();
  if (!user) return ApiError.unauthorized();

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("lead_column_configs")
    .select("columns")
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return Response.json({ columns: DEFAULT_COLUMNS });
  }

  return Response.json({ columns: data.columns });
}

export async function POST(request: NextRequest) {
  const user = getSessionUser();
  if (!user) return ApiError.unauthorized();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited();

  const body = await request.json().catch(() => ({}));
  const validated = validate(ColumnSchema, body);

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("lead_column_configs")
    .upsert(
      {
        user_id: user.id,
        columns: validated.data.columns,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) return ApiError.internal("DB_ERROR", error.message);

  return Response.json({ columns: validated.data.columns });
}
