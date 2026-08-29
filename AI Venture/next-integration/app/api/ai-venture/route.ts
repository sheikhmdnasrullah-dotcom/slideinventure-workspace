import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { createEntry, listTree, VentureFsError } from "@/lib/ai-venture/fs";
import { logActivity } from "@/lib/activities/client";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 60, windowMs: 60_000, identifier: `ai-venture-tree:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const tree = await listTree();
    return Response.json({ tree });
  } catch (error) {
    return toJson(error);
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000, identifier: `ai-venture-create:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const body = await request.json();
    const { path, type } = body as { path?: string; type?: "file" | "folder" };
    if (!path || (type !== "file" && type !== "folder")) {
      return ApiError.badRequest("BAD_REQUEST", "path and type ('file' | 'folder') are required").toResponse();
    }
    await createEntry(path, type);
    logActivity({
      category: "ai_venture",
      action: "created",
      title: `${type === "folder" ? "Folder" : "File"} created`,
      description: path,
      entityId: path,
      entityType: type,
      metadata: { type },
    }).catch(() => {});
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof VentureFsError) return new ApiError(error.status, "VENTURE_FS_ERROR", error.message).toResponse();
    return toJson(error);
  }
}
