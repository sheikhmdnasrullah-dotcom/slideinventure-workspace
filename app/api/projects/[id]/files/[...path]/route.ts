import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getProjectStore, requireProjectUser, workspaceErrorToResponse } from "../../../_shared";

type Params = { params: Promise<{ id: string; path: string[] }> };

function joinPath(segments: string[] | undefined): string {
  return (segments ?? []).map((s) => decodeURIComponent(s)).join("/");
}

/**
 * GET → one file, three shapes:
 * - default: metadata + text (`{ file }`)
 * - `?raw=1`: raw bytes, served inline (`&attachment=1` forces download)
 * - `?versions=1`: version history (`{ versions }`)
 * - `?version=<id>`: one version's full content (`{ version }`)
 */
export async function GET(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 180, windowMs: 60_000, identifier: `pw-file-read:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id, path } = await params;
    const store = getProjectStore();
    const filePath = joinPath(path);
    const search = request.nextUrl.searchParams;

    if (search.get("raw") === "1") {
      const { bytes, mimeType, name } = store.readFileBytes(user.id, id, filePath);
      const attachment = search.get("attachment") === "1";
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(bytes.length),
          "Content-Disposition": `${attachment ? "attachment" : "inline"}; filename="${encodeURIComponent(name)}"`,
        },
      });
    }

    const versionId = search.get("version");
    if (versionId) {
      const version = store.getVersion(user.id, id, filePath, versionId);
      return Response.json({ version });
    }
    if (search.get("versions") === "1") {
      return Response.json({ versions: store.listVersions(user.id, id, filePath) });
    }

    const file = await store.readFile(user.id, id, filePath);
    return Response.json({ file });
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}

/** PUT → overwrite an editable file. Requires `expectedHash` (conflict guard). */
export async function PUT(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 60, windowMs: 60_000, identifier: `pw-file-save:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id, path } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      content?: unknown;
      expectedHash?: unknown;
    };
    if (typeof body.content !== "string") {
      return ApiError.badRequest("CONTENT_REQUIRED", "Content is required").toResponse();
    }
    if (typeof body.expectedHash !== "string" || !body.expectedHash) {
      return ApiError.badRequest(
        "HASH_REQUIRED",
        "expectedHash is required so concurrent edits can't overwrite each other"
      ).toResponse();
    }
    const file = getProjectStore().updateFile(user.id, id, joinPath(path), body.content, {
      expectedHash: body.expectedHash,
      actor: user.email,
    });
    return Response.json({ file });
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}

/**
 * PATCH → rename/move. Body: { toDir?: string, newName?: string }.
 * Either may be omitted (rename in place / move keeping the name).
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000, identifier: `pw-file-move:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id, path } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      toDir?: unknown;
      newName?: unknown;
    };
    const moved = getProjectStore().move(
      user.id,
      id,
      joinPath(path),
      typeof body.toDir === "string" ? body.toDir : "",
      typeof body.newName === "string" ? body.newName : undefined
    );
    return Response.json(moved);
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}

/** POST → restore a version. Body: { action: "restore", versionId, expectedHash }. */
export async function POST(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000, identifier: `pw-file-restore:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id, path } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
      versionId?: unknown;
      expectedHash?: unknown;
    };
    if (body.action !== "restore") {
      return ApiError.badRequest("ACTION_REQUIRED", 'action must be "restore"').toResponse();
    }
    if (typeof body.versionId !== "string" || !body.versionId) {
      return ApiError.badRequest("VERSION_REQUIRED", "versionId is required").toResponse();
    }
    if (typeof body.expectedHash !== "string" || !body.expectedHash) {
      return ApiError.badRequest("HASH_REQUIRED", "expectedHash is required").toResponse();
    }
    const file = getProjectStore().restoreVersion(user.id, id, joinPath(path), body.versionId, {
      expectedHash: body.expectedHash,
      actor: user.email,
    });
    return Response.json({ file });
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}

/** DELETE → delete a file or an empty folder. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000, identifier: `pw-file-delete:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id, path } = await params;
    const rel = joinPath(path);
    getProjectStore().delete(user.id, id, rel);
    return Response.json({ path: rel, status: "deleted" });
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}
