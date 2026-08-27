import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { logActivity } from "@/lib/activities/client";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const SESSIONS = APPWRITE.collections.chatSessions;
const MESSAGES = APPWRITE.collections.chatMessages;

const BATCH = 100;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;

  // Ownership check: a session belongs to the current user by email.
  const owned = await databases.listDocuments(DB, SESSIONS, [
    Query.equal("$id", id),
    Query.equal("user_email", user.email ?? ""),
    Query.limit(1),
  ]);
  if (owned.documents.length === 0) {
    return ApiError.notFound("SESSION_NOT_FOUND", "Chat session not found").toResponse();
  }

  try {
    // Remove every message belonging to this session, paging through batches
    // so a long session is fully deleted.
    let removed = 0;
    while (true) {
      const res = await databases.listDocuments(DB, MESSAGES, [
        Query.equal("session_id", id),
        Query.limit(BATCH),
      ]);
      if (res.documents.length === 0) break;
      for (const doc of res.documents) {
        await databases.deleteDocument(DB, MESSAGES, doc.$id);
        removed += 1;
      }
      if (res.documents.length < BATCH) break;
    }

    await databases.deleteDocument(DB, SESSIONS, id);

    await logActivity({
      category: "chat",
      action: "deleted",
      title: owned.documents[0]?.title ?? "Chat session",
      description: `Deleted session with ${removed} message(s)`,
      entityId: id,
      entityType: "chat_session",
      metadata: { messageCount: removed },
    }).catch(() => {});

    return Response.json({ id, status: "deleted", messagesRemoved: removed });
  } catch (error) {
    return toJson(error);
  }
}
