import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getProjectStore, requireProjectUser, workspaceErrorToResponse } from "./_shared";

export async function GET(request: NextRequest) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 60, windowMs: 60_000, identifier: `pw-projects-list:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    return Response.json({ projects: getProjectStore().listProjects(user.id) });
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000, identifier: `pw-projects-create:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      description?: unknown;
    };
    if (typeof body.name !== "string" || !body.name.trim()) {
      return ApiError.badRequest("NAME_REQUIRED", "Project name is required").toResponse();
    }
    const project = getProjectStore().createProject(
      user.id,
      user.email,
      body.name,
      typeof body.description === "string" ? body.description : undefined
    );
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}
