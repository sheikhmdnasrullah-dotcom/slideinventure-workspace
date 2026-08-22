import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { UserSchema, User } from "@/lib/api/schemas";
import { NextRequest } from "next/server";
import { recordAudit } from "@/lib/api/audit";

const UpdateSchema = UserSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase.from("users").select("*").eq("id", id).single();

  if (error || !data) return ApiError.notFound("USER_NOT_FOUND", "User not found").toResponse();

  return Response.json(data as User);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return toJson(ApiError.rateLimited("RATE_LIMITED", "Too many requests", Math.ceil(limit.resetAt / 1000)));

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const validated = validate(UpdateSchema, body);

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase.from("users").select("*").eq("id", id).single();

  const { error } = await supabase
    .from("users")
    .update({ ...validated.data, updated_at: now })
    .eq("id", id);

  if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();

  await recordAudit({
    table: "users",
    recordId: id,
    action: "update",
    diff: { before: existing, after: validated.data },
    actor: { userEmail: user.email ?? undefined, userId: user.id },
  });

  return Response.json({ id, status: "updated" });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return toJson(ApiError.rateLimited("RATE_LIMITED", "Too many requests", Math.ceil(limit.resetAt / 1000)));

  const { id } = await params;
  const supabase = createServiceClient();

  await recordAudit({
    table: "users",
    recordId: id,
    action: "delete",
    actor: { userEmail: user.email ?? undefined, userId: user.id },
  });

  const { error } = await supabase.from("users").delete().eq("id", id);

  if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();

  return Response.json({ id, status: "deleted" });
}
