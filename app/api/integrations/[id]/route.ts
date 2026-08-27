import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { IntegrationSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.integrations;

const UpdateSchema = IntegrationSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });

function safeParse(value: unknown, fallback: unknown = {}) {
  if (typeof value !== "string") return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function serialize(doc: Record<string, any>) {
  return {
    id: doc.$id,
    name: doc.name,
    provider: doc.provider,
    type: doc.type,
    status: doc.status,
    config: safeParse(doc.config, {}),
    last_sync_at: doc.last_sync_at ?? null,
    last_error: doc.last_error ?? null,
    created_by: doc.created_by ?? null,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
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
  if (!doc) return ApiError.notFound("INTEGRATION_NOT_FOUND", "Integration not found").toResponse();

  return Response.json(serialize(doc));
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  const doc = await fetchOwned(id, user.email ?? "");
  if (!doc) return ApiError.notFound("INTEGRATION_NOT_FOUND", "Integration not found").toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(UpdateSchema, body);
  const v = validated.data;
  const now = new Date().toISOString();

  // status/config default in IntegrationSchema, so a partial update always
  // sees them as "defined" even when omitted. Check raw body presence.
  const update: Record<string, unknown> = { updated_at: now };
  if (v.name !== undefined) update.name = v.name;
  if (v.provider !== undefined) update.provider = v.provider;
  if (v.type !== undefined) update.type = v.type;
  if ("status" in body) update.status = v.status;
  if ("config" in body) update.config = JSON.stringify(v.config ?? {});
  if (v.lastSyncAt !== undefined) update.last_sync_at = v.lastSyncAt;
  if (v.lastError !== undefined) update.last_error = v.lastError;

  try {
    await databases.updateDocument(DB, COL, id, update);
    return Response.json({ id, status: "updated" });
  } catch (error) {
    return toJson(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  const doc = await fetchOwned(id, user.email ?? "");
  if (!doc) return ApiError.notFound("INTEGRATION_NOT_FOUND", "Integration not found").toResponse();

  try {
    await databases.deleteDocument(DB, COL, id);
    return Response.json({ id, status: "deleted" });
  } catch (error) {
    return toJson(error);
  }
}
