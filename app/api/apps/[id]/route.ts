import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { AppSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.apps;

function serialize(doc: Record<string, any>) {
  const out: Record<string, any> = { id: doc.$id };
  for (const [k, v] of Object.entries(doc)) {
    if (k.startsWith("$")) continue;
    out[k] = k === "config" && typeof v === "string" ? JSON.parse(v) : v;
  }
  return out;
}

async function fetchOwned(id: string) {
  const res = await databases.listDocuments(DB, COL, [Query.equal("$id", id)]);
  return res.documents[0] ?? null;
}

const UpdateSchema = AppSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  try {
    const doc = await fetchOwned(id);
    if (!doc) return ApiError.notFound("APP_NOT_FOUND", "App not found").toResponse();
    return Response.json(serialize(doc));
  } catch (error) {
    return ApiError.internal("DB_ERROR", (error as Error).message).toResponse();
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  try {
    const doc = await fetchOwned(id);
    if (!doc) return ApiError.notFound("APP_NOT_FOUND", "App not found").toResponse();

    const body = await request.json().catch(() => ({}));
    const validated = validate(UpdateSchema, body);
    const d = validated.data;
    const now = new Date().toISOString();

    const payload: Record<string, unknown> = { updated_at: now };
    if (d.name !== undefined) payload.name = d.name;
    if (d.slug !== undefined) payload.slug = d.slug;
    if (d.description !== undefined) payload.description = d.description;
    if (d.icon !== undefined) payload.icon = d.icon;
    if (d.url !== undefined) payload.url = d.url;
    if (d.category !== undefined) payload.category = d.category;
    if (d.enabled !== undefined) payload.enabled = d.enabled;
    if (d.config !== undefined) payload.config = JSON.stringify(d.config);

    await databases.updateDocument(DB, COL, id, payload);
    return Response.json({ id, status: "updated" });
  } catch (error) {
    return ApiError.internal("DB_ERROR", (error as Error).message).toResponse();
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  try {
    const doc = await fetchOwned(id);
    if (!doc) return ApiError.notFound("APP_NOT_FOUND", "App not found").toResponse();

    await databases.deleteDocument(DB, COL, id);
    return Response.json({ id, status: "deleted" });
  } catch (error) {
    return ApiError.internal("DB_ERROR", (error as Error).message).toResponse();
  }
}
