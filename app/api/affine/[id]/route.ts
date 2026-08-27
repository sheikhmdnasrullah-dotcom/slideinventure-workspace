import { getSessionUser } from "@/lib/appwrite/auth";
import { databases, ID } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { ensureAffineCollection } from "@/lib/affine/ensure";
import { logActivity } from "@/lib/activities/client";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { normalizeBoardScope, BOARD_SCOPE_ACTIVITY } from "@/lib/boards/scope";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.affineWorkspaces;

function serialize(d: any) {
  return {
    id: d.$id,
    section: d.section,
    title: d.title ?? "Untitled",
    snapshot: d.snapshot ? safeParse(d.snapshot) : null,
    updated_at: d.updated_at,
  };
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureAffineCollection();
  try {
    const doc = await databases.getDocument(DB, COL, id);
    return Response.json({ workspace: serialize(doc) });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(req, { limit: 30, windowMs: 60_000, identifier: `affine-update:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  await ensureAffineCollection();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") update.title = body.title;
  if (body.snapshot !== undefined) update.snapshot = body.snapshot ? JSON.stringify(body.snapshot) : null;
  try {
    const doc = await databases.updateDocument(DB, COL, id, update);
    const scope = normalizeBoardScope(body.section);
    const { category, label } = BOARD_SCOPE_ACTIVITY[scope];
    await logActivity({
      category,
      action: "updated",
      title: doc.title ?? label,
      description: `Updated a ${body.section ?? scope} workspace`,
      entityId: id,
      entityType: "affine_workspace",
      metadata: { section: body.section },
    });
    return Response.json({ workspace: serialize(doc) });
  } catch (error) {
    return toJson(error);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const section = new URL(req.url).searchParams.get("section") ?? "brainstorm";
  await ensureAffineCollection();
  try {
    await databases.deleteDocument(DB, COL, id);
    await logActivity({
      category: section as any,
      action: "deleted",
      title: "Workspace",
      description: `Deleted a ${section} workspace`,
      entityId: id,
      entityType: "affine_workspace",
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Delete failed" }, { status: 404 });
  }
}
