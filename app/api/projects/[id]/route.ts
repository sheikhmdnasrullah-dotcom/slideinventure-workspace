import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getProjectStore, requireProjectUser, workspaceErrorToResponse } from "../_shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 120, windowMs: 60_000, identifier: `pw-project-get:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id } = await params;
    return Response.json({ project: getProjectStore().getProject(user.id, id) });
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000, identifier: `pw-project-update:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      description?: unknown;
    };
    const project = getProjectStore().updateProject(user.id, id, {
      name: typeof body.name === "string" ? body.name : undefined,
      description:
        typeof body.description === "string" || body.description === null
          ? body.description
          : undefined,
    });
    return Response.json({ project });
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000, identifier: `pw-project-delete:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id } = await params;
    getProjectStore().deleteProject(user.id, id);
    return Response.json({ id, status: "deleted" });
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}
