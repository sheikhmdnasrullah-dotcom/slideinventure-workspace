import { getSessionUser } from "@/lib/appwrite/auth";
import { storage, ID, Permission, Role } from "@/lib/appwrite/server";
import { InputFile } from "node-appwrite/file";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, {
    limit: 20,
    windowMs: 60_000,
    identifier: `notes-image:${user.id}`,
  });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return ApiError.badRequest("FILE_REQUIRED", "File is required").toResponse();
    }

    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return ApiError.badRequest("FILE_TOO_LARGE", "Image exceeds 15MB limit").toResponse();
    }

    if (!file.type.startsWith("image/")) {
      return ApiError.badRequest("UNSUPPORTED_TYPE", "Only image files are supported").toResponse();
    }

    const id = ID.unique();
    const bytes = await file.arrayBuffer();

    await storage.createFile(
      "files",
      id,
      InputFile.fromBuffer(Buffer.from(bytes), file.name),
      [Permission.read(Role.any())]
    );

    const url = `${APPWRITE.endpoint}/storage/buckets/files/files/${id}/view?project=${APPWRITE.projectId}`;

    return Response.json({ url }, { status: 201 });
  } catch (error) {
    return ApiError.internal("UPLOAD_ERROR", error instanceof Error ? error.message : "Upload failed").toResponse();
  }
}
