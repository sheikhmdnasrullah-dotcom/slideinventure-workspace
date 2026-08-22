import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { LeadSchema, type Lead } from "@/lib/api/schemas";
import { recordAudit } from "@/lib/api/audit";
import { NextRequest } from "next/server";

const UpdateSchema = LeadSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return toJson(ApiError.unauthorized());

  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase.from("leads").select("*").eq("id", id).single();

  if (error || !data) return toJson(ApiError.notFound("LEAD_NOT_FOUND", "Lead not found"));

  return Response.json(data as Lead);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return toJson(ApiError.unauthorized());

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return toJson(ApiError.rateLimited());

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const validated = validate(UpdateSchema, body);

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase.from("leads").select("*").eq("id", id).single();

  const { error } = await supabase
    .from("leads")
    .update({ ...validated.data, updated_at: now })
    .eq("id", id);

  if (error) return toJson(ApiError.internal("DB_ERROR", error.message));

  await recordAudit({
    table: "leads",
    recordId: id,
    action: "update",
    diff: { before: existing, after: validated.data },
    actor: { userEmail: user.email ?? undefined, userId: user.id },
  });

  return Response.json({ id, status: "updated" });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return toJson(ApiError.unauthorized());

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return toJson(ApiError.rateLimited());

  const { id } = await params;
  const supabase = createServiceClient();

  await recordAudit({
    table: "leads",
    recordId: id,
    action: "delete",
    actor: { userEmail: user.email ?? undefined, userId: user.id },
  });

  const { error } = await supabase.from("leads").delete().eq("id", id);

  if (error) return toJson(ApiError.internal("DB_ERROR", error.message));

  return Response.json({ id, status: "deleted" });
}
