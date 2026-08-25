import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { UserSchema, User } from "@/lib/api/schemas";
import { NextRequest } from "next/server";
import { recordAudit } from "@/lib/api/audit";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.users;

const UpdateSchema = UserSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });

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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;

  try {
    const res = await databases.listDocuments(DB, COL, [Query.equal("$id", id)]);
    const doc = res.documents[0];
    if (!doc) return ApiError.notFound("USER_NOT_FOUND", "User not found").toResponse();
    return Response.json(serialize(doc) as User);
  } catch (error) {
    return toJson(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited("RATE_LIMITED", "Too many requests", Math.ceil(limit.resetAt / 1000)).toResponse();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const validated = validate(UpdateSchema, body);
  const now = new Date().toISOString();

  try {
    const existingRes = await databases.listDocuments(DB, COL, [Query.equal("$id", id)]);
    const existing = existingRes.documents[0];

    const update: Record<string, unknown> = { updated_at: now };
    if (validated.data.email !== undefined) update.email = validated.data.email;
    if (validated.data.fullName !== undefined) update.full_name = validated.data.fullName;
    if (validated.data.avatarUrl !== undefined) update.avatar_url = validated.data.avatarUrl;
    if (validated.data.role !== undefined) update.role = validated.data.role;

    await databases.updateDocument(DB, COL, id, update);

    await recordAudit({
      table: "users",
      recordId: id,
      action: "update",
      diff: { before: existing, after: validated.data },
      actor: { userEmail: user.email ?? undefined, userId: user.id },
    });

    return Response.json({ id, status: "updated" });
  } catch (error) {
    return toJson(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited("RATE_LIMITED", "Too many requests", Math.ceil(limit.resetAt / 1000)).toResponse();

  const { id } = await params;

  try {
    await recordAudit({
      table: "users",
      recordId: id,
      action: "delete",
      actor: { userEmail: user.email ?? undefined, userId: user.id },
    });

    const res = await databases.listDocuments(DB, COL, [Query.equal("$id", id)]);
    if (res.documents.length === 0) return ApiError.notFound("USER_NOT_FOUND", "User not found").toResponse();
    await databases.deleteDocument(DB, COL, id);

    return Response.json({ id, status: "deleted" });
  } catch (error) {
    return toJson(error);
  }
}
