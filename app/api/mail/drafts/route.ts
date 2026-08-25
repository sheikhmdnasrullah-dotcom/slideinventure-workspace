import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery, validate } from "@/lib/api/validation";
import { z } from "zod";
import { EmailDraftSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.emailDrafts;

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  accountId: z.string().optional(),
});

const CreateSchema = EmailDraftSchema.omit({ id: true, createdAt: true, updatedAt: true });

function serialize(doc: Record<string, any>) {
  return {
    id: doc.$id,
    account_id: doc.account_id,
    to: doc.to ?? [],
    cc: doc.cc ?? [],
    bcc: doc.bcc ?? [],
    subject: doc.subject,
    body: doc.body,
    reply_to_message_id: doc.reply_to_message_id,
    created_by: doc.created_by,
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

  const queries = [];
  if (query.data.accountId) queries.push(Query.equal("account_id", query.data.accountId));
  queries.push(Query.limit(query.data.pageSize));
  queries.push(Query.offset((query.data.page - 1) * query.data.pageSize));
  queries.push(Query.orderDesc("updated_at"));

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

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(CreateSchema, body);
  const now = new Date().toISOString();

  try {
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      account_id: validated.data.accountId,
      to: validated.data.to ?? [],
      cc: validated.data.cc ?? [],
      bcc: validated.data.bcc ?? [],
      subject: validated.data.subject ?? null,
      body: validated.data.body ?? null,
      reply_to_message_id: validated.data.replyToMessageId ?? null,
      created_by: user.email ?? null,
      created_at: now,
      updated_at: now,
    });
    return Response.json({ id: doc.$id }, { status: 201 });
  } catch (error) {
    return toJson(error);
  }
}
