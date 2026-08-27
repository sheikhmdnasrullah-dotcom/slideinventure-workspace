import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { SecretVaultEntrySchema } from "@/lib/api/schemas";
import { encryptSecret } from "@/lib/vault/crypto";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.vault;

const UpdateSchema = SecretVaultEntrySchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  iv: true,
  keyVersion: true,
});

function serialize(doc: Record<string, any>) {
  return {
    id: doc.$id,
    name: doc.name,
    category: doc.category,
    serviceName: doc.service_name,
    username: doc.username,
    secretType: doc.secret_type,
    url: doc.url,
    notes: doc.notes,
    tags: doc.tags ?? [],
    expiresAt: doc.expires_at,
    createdBy: doc.created_by,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

async function fetchOwned(id: string, email: string) {
  const res = await databases.listDocuments(DB, COL, [
    Query.equal("$id", id),
    Query.equal("created_by", email),
  ]);
  return res.documents[0] ?? null;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  const doc = await fetchOwned(id, user.email ?? "");
  if (!doc) return ApiError.notFound("VAULT_ENTRY_NOT_FOUND", "Vault entry not found").toResponse();

  return Response.json(serialize(doc));
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  const doc = await fetchOwned(id, user.email ?? "");
  if (!doc) return ApiError.notFound("VAULT_ENTRY_NOT_FOUND", "Vault entry not found").toResponse();

  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const validated = validate(UpdateSchema, body);
  const now = new Date().toISOString();

  // This previously wrote every field unconditionally on every PUT — since
  // secretType/tags default in SecretVaultEntrySchema (and the rest default
  // to null via `?? null`), any partial update (e.g. just a rename) silently
  // wiped category/serviceName/username/url/notes/tags/secretType back to
  // null/defaults. Only touch a field the request actually sent.
  const updateData: Record<string, unknown> = { updated_at: now };
  if ("name" in body) updateData.name = validated.data.name;
  if ("category" in body) updateData.category = validated.data.category ?? null;
  if ("serviceName" in body) updateData.service_name = validated.data.serviceName ?? null;
  if ("username" in body) updateData.username = validated.data.username ?? null;
  if ("secretType" in body) updateData.secret_type = validated.data.secretType;
  if ("url" in body) updateData.url = validated.data.url ?? null;
  if ("notes" in body) updateData.notes = validated.data.notes ?? null;
  if ("tags" in body) updateData.tags = validated.data.tags ?? [];
  if ("expiresAt" in body) updateData.expires_at = validated.data.expiresAt ?? null;

  if (validated.data.encryptedValue) {
    const { encrypted, iv } = encryptSecret(validated.data.encryptedValue);
    updateData.encrypted_value = encrypted;
    updateData.iv = iv;
    updateData.key_version = 1;
  }

  await databases.updateDocument(DB, COL, id, updateData);
  return Response.json({ id, status: "updated" });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(_request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  const doc = await fetchOwned(id, user.email ?? "");
  if (!doc) return ApiError.notFound("VAULT_ENTRY_NOT_FOUND", "Vault entry not found").toResponse();

  await databases.deleteDocument(DB, COL, id);
  return Response.json({ id, status: "deleted" });
}
