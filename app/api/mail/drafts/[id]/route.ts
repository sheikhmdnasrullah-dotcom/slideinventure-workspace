import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { EmailDraftSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.emailDrafts;

const UpdateSchema = EmailDraftSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });

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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;

  try {
    const res = await databases.listDocuments(DB, COL, [Query.equal("$id", id)]);
    const doc = res.documents[0];
    if (!doc) return ApiError.notFound("DRAFT_NOT_FOUND", "Draft not found").toResponse();
    return Response.json(serialize(doc));
  } catch (error) {
    return toJson(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const validated = validate(UpdateSchema, body);
  const now = new Date().toISOString();

  try {
    const update: Record<string, unknown> = { updated_at: now };
    if (validated.data.accountId !== undefined) update.account_id = validated.data.accountId;
    if (validated.data.to !== undefined) update.to = validated.data.to;
    if (validated.data.cc !== undefined) update.cc = validated.data.cc;
    if (validated.data.bcc !== undefined) update.bcc = validated.data.bcc;
    if (validated.data.subject !== undefined) update.subject = validated.data.subject;
    if (validated.data.body !== undefined) update.body = validated.data.body;
    if (validated.data.replyToMessageId !== undefined) update.reply_to_message_id = validated.data.replyToMessageId;

    await databases.updateDocument(DB, COL, id, update);
    return Response.json({ id, status: "updated" });
  } catch (error) {
    return toJson(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;

  try {
    const res = await databases.listDocuments(DB, COL, [Query.equal("$id", id)]);
    if (res.documents.length === 0) return ApiError.notFound("DRAFT_NOT_FOUND", "Draft not found").toResponse();
    await databases.deleteDocument(DB, COL, id);
    return Response.json({ id, status: "deleted" });
  } catch (error) {
    return toJson(error);
  }
}
