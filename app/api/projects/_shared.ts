import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError, toJson } from "@/lib/api/errors";
import { ProjectStore, WorkspaceError } from "@/lib/project-workspace/store";
import { InvalidPathError } from "@/lib/project-workspace/paths";

let shared: ProjectStore | null = null;

/** One store per server process (root comes from PROJECT_WORKSPACE_DIR). */
export function getProjectStore(): ProjectStore {
  if (!shared) shared = new ProjectStore();
  return shared;
}

export type AuthedUser = { id: string; email: string };

export async function requireProjectUser(): Promise<AuthedUser | Response> {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();
  return user;
}

export function workspaceErrorToResponse(error: unknown): Response {
  if (error instanceof InvalidPathError) {
    return ApiError.badRequest("INVALID_PATH", error.message).toResponse();
  }
  if (error instanceof WorkspaceError) {
    switch (error.code) {
      case "NOT_FOUND":
        return ApiError.notFound("PW_NOT_FOUND", error.message).toResponse();
      case "ALREADY_EXISTS":
        return ApiError.conflict("PW_EXISTS", error.message).toResponse();
      case "CONFLICT":
        return ApiError.conflict("PW_CONFLICT", error.message, error.details).toResponse();
      case "TOO_LARGE":
        return ApiError.badRequest("PW_TOO_LARGE", error.message).toResponse();
      case "NOT_EDITABLE":
      case "UNSUPPORTED":
        return ApiError.badRequest("PW_UNSUPPORTED", error.message).toResponse();
      case "NOT_EMPTY":
        return ApiError.badRequest("PW_NOT_EMPTY", error.message).toResponse();
      default:
        return ApiError.badRequest("PW_INVALID", error.message).toResponse();
    }
  }
  return toJson(error);
}
