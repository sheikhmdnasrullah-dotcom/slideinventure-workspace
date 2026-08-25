import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery, validate } from "@/lib/api/validation";
import { z } from "zod";
import { UserSchema, type User } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.users;
const PAGE_CAP = 1000;

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.string().optional(),
});

function serialize(doc: Record<string, any>): User {
  return {
    id: doc.$id,
    email: doc.email,
    full_name: doc.full_name,
    avatar_url: doc.avatar_url,
    role: doc.role,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  } as unknown as User;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited("RATE_LIMITED", "Too many requests", Math.ceil(limit.resetAt / 1000)).toResponse();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);

  try {
    let allDocs: Record<string, any>[] = [];

    if (query.data.search) {
      const [eRes, nRes] = await Promise.all([
        databases.listDocuments(DB, COL, [Query.contains("email", query.data.search), Query.limit(PAGE_CAP)]),
        databases.listDocuments(DB, COL, [Query.contains("full_name", query.data.search), Query.limit(PAGE_CAP)]),
      ]);
      const map = new Map<string, Record<string, any>>();
      for (const d of [...eRes.documents, ...nRes.documents]) if (!map.has(d.$id)) map.set(d.$id, d);
      allDocs = [...map.values()];
    } else {
      const res = await databases.listDocuments(DB, COL, [Query.limit(PAGE_CAP)]);
      allDocs = res.documents;
    }

    if (query.data.role) allDocs = allDocs.filter((d) => d.role === query.data.role);
    allDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = allDocs.length;
    const from = (query.data.page - 1) * query.data.pageSize;
    const pageDocs = allDocs.slice(from, from + query.data.pageSize);

    return Response.json({
      data: pageDocs.map(serialize),
      total,
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
  if (!limit.allowed) return ApiError.rateLimited("RATE_LIMITED", "Too many requests", Math.ceil(limit.resetAt / 1000)).toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(UserSchema.omit({ id: true, createdAt: true, updatedAt: true }), body);
  const now = new Date().toISOString();

  try {
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      email: validated.data.email,
      full_name: validated.data.fullName ?? null,
      avatar_url: validated.data.avatarUrl ?? null,
      role: validated.data.role ?? "member",
      created_at: now,
      updated_at: now,
    });
    return Response.json({ id: doc.$id }, { status: 201 });
  } catch (error) {
    return toJson(error);
  }
}
