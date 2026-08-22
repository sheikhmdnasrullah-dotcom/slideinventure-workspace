import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { SecretVaultEntrySchema } from "@/lib/api/schemas";
import { encryptSecret, decryptSecret } from "@/lib/vault/crypto";
import { recordAudit } from "@/lib/api/audit";
import { NextRequest } from "next/server";

const UpdateSchema = SecretVaultEntrySchema.partial().omit({ id: true, createdAt: true, updatedAt: true, iv: true, keyVersion: true });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("secret_vault_entries")
    .select("id, name, category, service_name, username, secret_type, url, notes, tags, expires_at, created_by, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error || !data) return ApiError.notFound("VAULT_ENTRY_NOT_FOUND", "Vault entry not found").toResponse();

  return Response.json(data);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const validated = validate(UpdateSchema, body);

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {
    name: validated.data.name,
    category: validated.data.category ?? null,
    service_name: validated.data.serviceName ?? null,
    username: validated.data.username ?? null,
    secret_type: validated.data.secretType,
    url: validated.data.url ?? null,
    notes: validated.data.notes ?? null,
    tags: validated.data.tags ?? [],
    expires_at: validated.data.expiresAt ?? null,
    updated_at: now,
  };

  if (validated.data.encryptedValue) {
    const { encrypted, iv } = encryptSecret(validated.data.encryptedValue);
    updateData.encrypted_value = encrypted;
    updateData.iv = iv;
    updateData.key_version = 1;
  }

  const { error } = await supabase.from("secret_vault_entries").update(updateData).eq("id", id);

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

  const { error } = await supabase.from("secret_vault_entries").delete().eq("id", id);

  if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();

  return Response.json({ id, status: "deleted" });
}
