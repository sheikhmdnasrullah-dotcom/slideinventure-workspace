import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery, validate } from "@/lib/api/validation";
import { z } from "zod";
import { DocumentSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.documents;

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.string().optional(),
  tag: z.string().optional(),
});

const CreateSchema = DocumentSchema.omit({ id: true, createdAt: true, updatedAt: true });

function serialize(doc: Record<string, any>) {
  return {
    id: doc.$id,
    title: doc.title,
    filename: doc.filename,
    mime_type: doc.mime_type,
    size_bytes: doc.size_bytes,
    storage_path: doc.storage_path,
    url: doc.url,
    tags: doc.tags ?? [],
    status: doc.status,
    author: doc.author,
    source: doc.source,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);

  const queries = [Query.limit(query.data.pageSize), Query.offset((query.data.page - 1) * query.data.pageSize)];
  if (query.data.status) queries.push(Query.equal("status", query.data.status));
  if (query.data.tag) queries.push(Query.contains("tags", query.data.tag));
  queries.push(Query.orderDesc("created_at"));

  try {
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
  const now = new Date().toISOString();

  try {
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      title: validated.data.title,
      filename: validated.data.filename,
      mime_type: validated.data.mimeType,
      size_bytes: validated.data.sizeBytes,
      storage_path: validated.data.storagePath,
      url: validated.data.url ?? null,
      tags: validated.data.tags ?? [],
      status: validated.data.status ?? "active",
      author: user.email ?? validated.data.author ?? null,
      source: validated.data.source ?? "dashboard",
      created_at: now,
      updated_at: now,
    });
    return Response.json({ id: doc.$id }, { status: 201 });
  } catch (error) {
    return toJson(error);
  }
}
