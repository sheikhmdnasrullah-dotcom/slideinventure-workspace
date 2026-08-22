import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { UsefulLinkSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const UpdateSchema = UsefulLinkSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase.from("useful_links").select("*").eq("id", id).single();

  if (error || !data) return ApiError.notFound("LINK_NOT_FOUND", "Link not found").toResponse();

  return Response.json(data);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const validated = validate(UpdateSchema, body);

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("useful_links")
    .update({ ...validated.data, updated_at: now })
    .eq("id", id);

  if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();

  return Response.json({ id, status: "updated" });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  const supabase = createServiceClient();

  const { error } = await supabase.from("useful_links").delete().eq("id", id);

  if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();

  return Response.json({ id, status: "deleted" });
}
