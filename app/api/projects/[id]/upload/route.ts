import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { LIMITS } from "@/lib/project-workspace/types";
import { joinProjectPath } from "@/lib/project-workspace/store";
import { getProjectStore, requireProjectUser, workspaceErrorToResponse } from "../../_shared";

type Params = { params: Promise<{ id: string }> };

/**
 * POST multipart: `file` (required), `folder` (optional destination folder),
 * `name` (optional override). Stores the bytes as a project file.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000, identifier: `pw-upload:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return ApiError.badRequest("FILE_REQUIRED", "A file upload is required").toResponse();
    }
    if (file.size > LIMITS.maxUploadBytes) {
      return ApiError.badRequest("PW_TOO_LARGE", "File exceeds the 10MB upload limit").toResponse();
    }
    const folder = form.get("folder");
    const nameOverride = form.get("name");
    const name =
      (typeof nameOverride === "string" && nameOverride.trim()) || file.name || "upload";
    const dest = joinProjectPath(typeof folder === "string" ? folder : "", name);
    const bytes = Buffer.from(await file.arrayBuffer());
    const saved = getProjectStore().saveUpload(user.id, id, dest, bytes, user.email);
    return Response.json(saved, { status: 201 });
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}
