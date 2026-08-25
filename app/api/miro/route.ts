import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery, validate } from "@/lib/api/validation";
import { z } from "zod";
import { MiroActivitySchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.miroActivity;

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  eventType: z.string().optional(),
  boardId: z.string().optional(),
});

const CreateSchema = MiroActivitySchema.omit({ id: true, createdAt: true });

function parseJson(v: unknown) {
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return {}; }
  }
  return v ?? {};
}

function serialize(doc: Record<string, any>) {
  return {
    id: doc.$id,
    event_type: doc.event_type,
    board_id: doc.board_id,
    card_id: doc.card_id,
    user_id: doc.user_id,
    user_name: doc.user_name,
    action: doc.action,
    metadata: parseJson(doc.metadata),
    created_at: doc.created_at,
  };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);

  const queries: string[] = [Query.orderDesc("created_at")];
  if (query.data.eventType) queries.push(Query.equal("event_type", query.data.eventType));
  if (query.data.boardId) queries.push(Query.equal("board_id", query.data.boardId));
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
    return ApiError.internal("DB_ERROR", (error as Error).message).toResponse();
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 50, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(CreateSchema, body);

  const id = ID.unique();
  const now = new Date().toISOString();

  try {
    await databases.createDocument(DB, COL, id, {
      event_type: validated.data.eventType,
      board_id: validated.data.boardId ?? null,
      card_id: validated.data.cardId ?? null,
      user_id: validated.data.userId ?? null,
      user_name: validated.data.userName ?? null,
      action: validated.data.action ?? null,
      metadata: JSON.stringify(validated.data.metadata ?? {}),
      created_at: now,
    });
  } catch (error) {
    return ApiError.internal("DB_ERROR", (error as Error).message).toResponse();
  }

  return Response.json({ id }, { status: 201 });
}
