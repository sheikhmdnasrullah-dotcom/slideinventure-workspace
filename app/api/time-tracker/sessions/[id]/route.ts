import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { ensureWorkSessionsCollection } from "@/lib/time-tracker/ensure";
import { logActivity } from "@/lib/activities/client";
import { publishEvent } from "@/lib/events/bus";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.workSessions ?? "work_sessions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  if (!id) return ApiError.badRequest("VALIDATION_ERROR", "Session ID is required").toResponse();

  await ensureWorkSessionsCollection();

  try {
    const existing = await databases.getDocument(DB, COL, id);
    if (existing.user_email !== user.email) {
      return ApiError.forbidden("FORBIDDEN", "Not allowed to edit this session").toResponse();
    }

    const body = await request.json().catch(() => ({}));
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.project !== undefined) updateData.project = String(body.project).trim();
    if (body.note !== undefined) updateData.note = String(body.note).trim();
    if (typeof body.duration === "number" && body.duration > 0) {
      updateData.duration = Math.round(body.duration);
    }

    const updated = await databases.updateDocument(DB, COL, id, updateData);

    publishEvent({
      type: "work_session.updated" as any,
      source: "dashboard",
      title: `Work session updated: ${updated.project}`,
      description: updated.note || "",
      entityId: id,
      entityType: "work_session",
      userEmail: user.email,
    });

    return Response.json({ session: updated });
  } catch (err) {
    console.error("Failed to update work session:", err);
    return ApiError.internal("DB_ERROR", "Failed to update work session").toResponse();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  if (!id) return ApiError.badRequest("VALIDATION_ERROR", "Session ID is required").toResponse();

  await ensureWorkSessionsCollection();

  try {
    const existing = await databases.getDocument(DB, COL, id);
    if (existing.user_email !== user.email) {
      return ApiError.forbidden("FORBIDDEN", "Not allowed to delete this session").toResponse();
    }

    await databases.deleteDocument(DB, COL, id);

    await logActivity({
      category: "system",
      action: "deleted",
      title: `Deleted work session: ${existing.project}`,
      description: `${existing.duration} seconds session removed`,
      entityId: id,
      entityType: "work_session",
      userEmail: user.email,
    }).catch(() => {});

    publishEvent({
      type: "work_session.deleted" as any,
      source: "dashboard",
      title: `Work session deleted: ${existing.project}`,
      description: "",
      entityId: id,
      entityType: "work_session",
      userEmail: user.email,
    });

    return Response.json({ success: true, id });
  } catch (err) {
    console.error("Failed to delete work session:", err);
    return ApiError.internal("DB_ERROR", "Failed to delete work session").toResponse();
  }
}
