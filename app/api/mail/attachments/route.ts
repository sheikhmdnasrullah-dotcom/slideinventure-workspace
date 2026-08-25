import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery, validate } from "@/lib/api/validation";
import { z } from "zod";
import { EmailAttachmentSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.emailAttachments;

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  emailId: z.string().optional(),
});

const CreateSchema = EmailAttachmentSchema.omit({ id: true, createdAt: true });

function serialize(doc: Record<string, any>) {
  return {
    id: doc.$id,
    email_id: doc.email_id,
    filename: doc.filename,
    mime_type: doc.mime_type,
    size_bytes: doc.size_bytes,
    content_id: doc.content_id,
    disposition: doc.disposition,
    download_url: doc.download_url,
    created_at: doc.created_at,
  };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);

  const queries = [];
  if (query.data.emailId) queries.push(Query.equal("email_id", query.data.emailId));
  queries.push(Query.limit(query.data.pageSize));
  queries.push(Query.offset((query.data.page - 1) * query.data.pageSize));
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

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(CreateSchema, body);
  const now = new Date().toISOString();

  try {
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      email_id: validated.data.emailId,
      filename: validated.data.filename,
      mime_type: validated.data.mimeType,
      size_bytes: validated.data.sizeBytes,
      content_id: validated.data.contentId ?? null,
      disposition: validated.data.disposition ?? null,
      download_url: validated.data.downloadUrl ?? null,
      created_at: now,
    });
    return Response.json({ id: doc.$id }, { status: 201 });
  } catch (error) {
    return toJson(error);
  }
}
