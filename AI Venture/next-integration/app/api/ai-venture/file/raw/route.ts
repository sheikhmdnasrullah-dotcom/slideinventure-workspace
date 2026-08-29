import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { readFileStream, VentureFsError } from "@/lib/ai-venture/fs";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 120, windowMs: 60_000, identifier: `ai-venture-raw:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const filePath = request.nextUrl.searchParams.get("path");
  if (!filePath) return ApiError.badRequest("BAD_REQUEST", "path query param is required").toResponse();

  try {
    const { stream, size, contentType, filename } = await readFileStream(filePath);
    return new Response(stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(size),
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    if (error instanceof VentureFsError) return new ApiError(error.status, "VENTURE_FS_ERROR", error.message).toResponse();
    return toJson(error);
  }
}
