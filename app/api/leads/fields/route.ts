import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { CustomLeadFieldSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const CreateSchema = CustomLeadFieldSchema.omit({ id: true, createdAt: true, updatedAt: true });
const UpdateSchema = CustomLeadFieldSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });

export async function GET(request: NextRequest) {
  const user = getSessionUser();
  if (!user) return ApiError.unauthorized();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("custom_lead_fields")
    .select("*")
    .order("\"order\"", { ascending: true });

  if (error) return ApiError.internal("DB_ERROR", error.message);

  return Response.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const user = getSessionUser();
  if (!user) return ApiError.unauthorized();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited();

  const body = await request.json().catch(() => ({}));
  const validated = validate(CreateSchema, body);

  const supabase = createServiceClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error } = await supabase.from("custom_lead_fields").insert({
    id,
    ...validated.data,
    created_at: now,
    updated_at: now,
  });

  if (error) return ApiError.internal("DB_ERROR", error.message);

  return Response.json({ id }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = getSessionUser();
  if (!user) return ApiError.unauthorized();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited();

  const body = await request.json().catch(() => ({}));
  const validated = validate(z.object({ id: z.string(), changes: UpdateSchema }), body);

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("custom_lead_fields")
    .update({ ...validated.data.changes, updated_at: now })
    .eq("id", validated.data.id);

  if (error) return ApiError.internal("DB_ERROR", error.message);

  return Response.json({ id: validated.data.id, status: "updated" });
}

export async function DELETE(request: NextRequest) {
  const user = getSessionUser();
  if (!user) return ApiError.unauthorized();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited();

  const body = await request.json().catch(() => ({}));
  const { id } = body as { id?: string };

  if (!id) return ApiError.badRequest("ID_REQUIRED", "Field id is required");

  const supabase = createServiceClient();
  const { error } = await supabase.from("custom_lead_fields").delete().eq("id", id);

  if (error) return ApiError.internal("DB_ERROR", error.message);

  return Response.json({ id, status: "deleted" });
}
