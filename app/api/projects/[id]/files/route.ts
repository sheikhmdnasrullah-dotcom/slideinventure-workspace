import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getProjectStore, requireProjectUser, workspaceErrorToResponse } from "../../_shared";

type Params = { params: Promise<{ id: string }> };

/** GET → full file tree. POST → create a file or folder. */
export async function GET(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 120, windowMs: 60_000, identifier: `pw-tree:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id } = await params;
    return Response.json({ tree: getProjectStore().listTree(user.id, id) });
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000, identifier: `pw-file-create:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      type?: unknown;
      path?: unknown;
      content?: unknown;
    };
    if (typeof body.path !== "string" || !body.path.trim()) {
      return ApiError.badRequest("PATH_REQUIRED", "Path is required").toResponse();
    }
    const store = getProjectStore();
    if (body.type === "folder") {
      const folder = store.createFolder(user.id, id, body.path);
      return Response.json({ folder }, { status: 201 });
    }
    if (typeof body.content !== "string") {
      return ApiError.badRequest("CONTENT_REQUIRED", "Content is required").toResponse();
    }
    const file = store.writeNewFile(user.id, id, body.path, body.content);
    return Response.json({ file }, { status: 201 });
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}
