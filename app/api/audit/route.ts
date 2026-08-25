import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery } from "@/lib/api/validation";
import { z } from "zod";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.auditLogs;

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  tableName: z.string().optional(),
  recordId: z.string().optional(),
  action: z.string().optional(),
  actorEmail: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

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
    table_name: doc.table_name,
    record_id: doc.record_id,
    action: doc.action,
    diff: safeParse(doc.diff, null),
    metadata: safeParse(doc.metadata, null),
    actor_email: doc.actor_email ?? null,
    actor_id: doc.actor_id ?? null,
    ip: doc.ip ?? null,
    user_agent: doc.user_agent ?? null,
    created_at: doc.created_at,
  };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);

  const queries: string[] = [];
  if (query.data.tableName) queries.push(Query.equal("table_name", query.data.tableName));
  if (query.data.recordId) queries.push(Query.equal("record_id", query.data.recordId));
  if (query.data.action) queries.push(Query.equal("action", query.data.action));
  if (query.data.actorEmail) queries.push(Query.equal("actor_email", query.data.actorEmail));
  if (query.data.from) queries.push(Query.greaterThanEqual("created_at", query.data.from));
  if (query.data.to) queries.push(Query.lessThanEqual("created_at", query.data.to));

  queries.push(Query.orderDesc("created_at"));
  queries.push(Query.limit(query.data.pageSize), Query.offset((query.data.page - 1) * query.data.pageSize));

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
