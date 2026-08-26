import { getSessionUser } from "@/lib/appwrite/auth";
import { databases, ID } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { NextRequest } from "next/server";
import { ensureActivitiesCollection } from "@/lib/activities/ensure";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.activities;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 200, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const {
    category,
    action,
    title,
    description,
    entityId,
    entityType,
    metadata,
  } = body as {
    category?: string;
    action?: string;
    title?: string;
    description?: string;
    entityId?: string;
    entityType?: string;
    metadata?: Record<string, unknown>;
  };

  if (!category || !action || !title) {
    return ApiError.badRequest("VALIDATION_ERROR", "category, action and title are required").toResponse();
  }

  try {
    await ensureActivitiesCollection();
    await databases.createDocument(DB, COL, ID.unique(), {
      category,
      action,
      title,
      description: description ?? "",
      entity_id: entityId ?? null,
      entity_type: entityType ?? null,
      timestamp: new Date().toISOString(),
      metadata: metadata ? JSON.stringify(metadata) : null,
      user_email: user.email ?? null,
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}
