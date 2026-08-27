import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { writeFileContent, VentureFsError } from "@/lib/ai-venture/fs";
import { logActivity } from "@/lib/activities/client";

// A real "pick a file from your device" upload — the AI Venture file system
// previously only supported creating an empty text file at a path via a
// prompt() dialog. No required title/description/category: the file itself
// is the only input.
const MAX_SIZE = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000, identifier: `ai-venture-upload:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const form = await request.formData();
    const file = form.get("file");
    const folder = ((form.get("folder") as string | null) ?? "").toString();
    if (!(file instanceof File)) {
      return ApiError.badRequest("FILE_REQUIRED", "File is required").toResponse();
    }
    if (file.size > MAX_SIZE) {
      return ApiError.badRequest("FILE_TOO_LARGE", "File exceeds 25MB limit").toResponse();
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const path = folder ? `${folder}/${file.name}` : file.name;

    await writeFileContent(path, buffer.toString("base64"), "base64");

    logActivity({
      category: "ai_venture",
      action: "uploaded",
      title: "File uploaded",
      description: file.name,
      entityId: path,
      entityType: "file",
      metadata: { size: file.size, type: file.type },
    }).catch(() => {});

    return Response.json({ ok: true, path }, { status: 201 });
  } catch (error) {
    if (error instanceof VentureFsError) return new ApiError(error.status, "VENTURE_FS_ERROR", error.message).toResponse();
    return toJson(error);
  }
}
