import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery, validate } from "@/lib/api/validation";
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

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  category: z.string().optional(),
  enabled: z.coerce.boolean().optional(),
});

const CreateSchema = AppSchema.omit({ id: true, createdAt: true, updatedAt: true });

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);
  const page = query.data.page;
  const pageSize = query.data.pageSize;

  try {
    const queries: any[] = [Query.orderAsc("name")];
    if (query.data.category) queries.push(Query.equal("category", query.data.category));
    if (query.data.enabled !== undefined) queries.push(Query.equal("enabled", query.data.enabled));
    queries.push(Query.limit(pageSize), Query.offset((page - 1) * pageSize));

    const res = await databases.listDocuments(DB, COL, queries);
    return Response.json({
      data: res.documents.map(serialize),
      total: res.total,
      page,
      pageSize,
    });
  } catch (error) {
    return ApiError.internal("DB_ERROR", (error as Error).message).toResponse();
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  try {
    const validated = validate(CreateSchema, body);
    const d = validated.data;
    const now = new Date().toISOString();

    const fallbackName = d.name?.trim() || (() => {
      try {
        return new URL(d.url ?? "").hostname;
      } catch {
        return "Untitled app";
      }
    })();
    const slug = d.slug?.trim() || fallbackName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || `app-${Date.now()}`;

    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      name: fallbackName,
      slug,
      description: d.description ?? null,
      icon: d.icon ?? null,
      url: d.url ?? null,
      category: d.category ?? null,
      enabled: d.enabled ?? true,
      config: JSON.stringify(d.config ?? {}),
      created_at: now,
      updated_at: now,
    });

    return Response.json({ id: doc.$id }, { status: 201 });
  } catch (err: any) {
    if (err instanceof ApiError) return err.toResponse();
    return ApiError.internal("UNHANDLED", err.message || "Unknown error").toResponse();
  }
}
