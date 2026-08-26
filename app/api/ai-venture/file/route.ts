import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { deleteEntry, moveEntry, readFileContent, VentureFsError, writeFileContent } from "@/lib/ai-venture/fs";

function fsErrorToResponse(error: unknown) {
  if (error instanceof VentureFsError) return new ApiError(error.status, "VENTURE_FS_ERROR", error.message).toResponse();
  return toJson(error);
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 120, windowMs: 60_000, identifier: `ai-venture-read:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const filePath = request.nextUrl.searchParams.get("path");
  if (!filePath) return ApiError.badRequest("BAD_REQUEST", "path query param is required").toResponse();

  try {
    const file = await readFileContent(filePath);
    return Response.json({ path: filePath, ...file });
  } catch (error) {
    return fsErrorToResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 60, windowMs: 60_000, identifier: `ai-venture-write:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const body = await request.json();
    const { path, content, encoding } = body as {
      path?: string;
      content?: string;
      encoding?: "utf-8" | "base64";
    };
    if (!path || typeof content !== "string") {
      return ApiError.badRequest("BAD_REQUEST", "path and content are required").toResponse();
    }
    await writeFileContent(path, content, encoding === "base64" ? "base64" : "utf-8");
    return Response.json({ ok: true });
  } catch (error) {
    return fsErrorToResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000, identifier: `ai-venture-move:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const body = await request.json();
    const { path, newPath } = body as { path?: string; newPath?: string };
    if (!path || !newPath) {
      return ApiError.badRequest("BAD_REQUEST", "path and newPath are required").toResponse();
    }
    await moveEntry(path, newPath);
    return Response.json({ ok: true });
  } catch (error) {
    return fsErrorToResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000, identifier: `ai-venture-delete:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const filePath = request.nextUrl.searchParams.get("path");
  if (!filePath) return ApiError.badRequest("BAD_REQUEST", "path query param is required").toResponse();

  try {
    await deleteEntry(filePath);
    return Response.json({ ok: true });
  } catch (error) {
    return fsErrorToResponse(error);
  }
}
