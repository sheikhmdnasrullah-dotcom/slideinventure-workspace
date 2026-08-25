import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { CustomLeadFieldSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.customLeadFields;

const CreateSchema = CustomLeadFieldSchema.omit({ id: true, createdAt: true, updatedAt: true });
const UpdateSchema = CustomLeadFieldSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });

function serialize(doc: Record<string, any>) {
  return {
    id: doc.$id,
    key: doc.key,
    label: doc.label,
    type: doc.type,
    options: doc.options ?? [],
    required: doc.required,
    visible: doc.visible,
    sortable: doc.sortable,
    filterable: doc.filterable,
    width: doc.width ?? null,
    order: doc.order,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const res = await databases.listDocuments(DB, COL, [Query.orderAsc("order")]);
    return Response.json(res.documents.map(serialize));
  } catch (error) {
    return toJson(error);
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(CreateSchema, body);
  const v = validated.data;
  const now = new Date().toISOString();

  try {
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      key: v.key,
      label: v.label,
      type: v.type,
      options: v.options ?? [],
      required: v.required ?? false,
      visible: v.visible ?? true,
      sortable: v.sortable ?? true,
      filterable: v.filterable ?? false,
      width: v.width ?? null,
      order: v.order ?? 0,
      created_at: now,
      updated_at: now,
    });
    return Response.json({ id: doc.$id }, { status: 201 });
  } catch (error) {
    return toJson(error);
  }
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(z.object({ id: z.string(), changes: UpdateSchema }), body);
  const { id, changes } = validated.data;
  const now = new Date().toISOString();

  try {
    const update: Record<string, unknown> = { updated_at: now };
    if (changes.key !== undefined) update.key = changes.key;
    if (changes.label !== undefined) update.label = changes.label;
    if (changes.type !== undefined) update.type = changes.type;
    if (changes.options !== undefined) update.options = changes.options;
    if (changes.required !== undefined) update.required = changes.required;
    if (changes.visible !== undefined) update.visible = changes.visible;
    if (changes.sortable !== undefined) update.sortable = changes.sortable;
    if (changes.filterable !== undefined) update.filterable = changes.filterable;
    if (changes.width !== undefined) update.width = changes.width;
    if (changes.order !== undefined) update.order = changes.order;

    await databases.updateDocument(DB, COL, id, update);
    return Response.json({ id, status: "updated" });
  } catch (error) {
    return toJson(error);
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const { id } = body as { id?: string };

  if (!id) return ApiError.badRequest("ID_REQUIRED", "Field id is required").toResponse();

  try {
    await databases.deleteDocument(DB, COL, id);
    return Response.json({ id, status: "deleted" });
  } catch (error) {
    return toJson(error);
  }
}
