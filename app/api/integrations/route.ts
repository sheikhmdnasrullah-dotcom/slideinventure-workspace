import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery, validate } from "@/lib/api/validation";
import { z } from "zod";
import { IntegrationSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.integrations;

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  provider: z.string().optional(),
  status: z.string().optional(),
});

const CreateSchema = IntegrationSchema.omit({ id: true, createdAt: true, updatedAt: true });

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

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const query = validateQuery(ListSchema, request.nextUrl.searchParams);
    const email = user.email ?? "";

    const queries = [Query.equal("created_by", email)];
    if (query.data.provider) queries.push(Query.equal("provider", query.data.provider));
    if (query.data.status) queries.push(Query.equal("status", query.data.status));
    queries.push(Query.orderDesc("created_at"));
    queries.push(Query.limit(query.data.pageSize), Query.offset((query.data.page - 1) * query.data.pageSize));

    const res = await databases.listDocuments(DB, COL, queries);
    return Response.json({
      data: res.documents.map(serialize),
      total: res.total,
      page: query.data.page,
      pageSize: query.data.pageSize,
    });
  } catch (error) {
    return toJson(error);
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(CreateSchema, body);
  const v = validated.data;
  const now = new Date().toISOString();

  try {
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      name: v.name,
      provider: v.provider,
      type: v.type,
      status: v.status ?? "inactive",
      config: JSON.stringify(v.config ?? {}),
      last_sync_at: v.lastSyncAt ?? null,
      last_error: v.lastError ?? null,
      created_by: user.email ?? null,
      created_at: now,
      updated_at: now,
    });
    return Response.json({ id: doc.$id }, { status: 201 });
  } catch (error) {
    return toJson(error);
  }
}
