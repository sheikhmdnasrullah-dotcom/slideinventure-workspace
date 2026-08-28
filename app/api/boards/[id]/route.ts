import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { logActivity } from "@/lib/activities/client";
import { normalizeBoardScope, BOARD_SCOPE_ACTIVITY } from "@/lib/boards/scope";
import { ensureBoardsCollection } from "@/lib/boards/ensure";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.boards;

type BoardDoc = {
  $id: string
  title?: string | null
  content?: string | null
  scope?: string | null
  created_at?: string | null
  updated_at?: string | null
}

function serialize(doc: BoardDoc) {
  return {
    id: doc.$id,
    title: doc.title ?? null,
    content: doc.content ?? "{}",
    scope: doc.scope || "global",
    created_at: doc.created_at ?? "",
    updated_at: doc.updated_at ?? "",
  };
}

async function fetchOwned(id: string, email: string) {
  await ensureBoardsCollection();
  const res = await databases.listDocuments(DB, COL, [
    Query.equal("$id", id),
    Query.equal("user_email", email),
  ]);
  return res.documents[0] ?? null;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  try {
    const doc = await fetchOwned(id, user.email ?? "");
    if (!doc) return ApiError.notFound().toResponse();
    return Response.json({ board: serialize(doc) });
  } catch (error) {
    return toJson(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000, identifier: `boards-update:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  try {
    const doc = await fetchOwned(id, user.email ?? "");
    if (!doc) return ApiError.notFound().toResponse();

    const body = await request.json().catch(() => ({}));
    const title = (body.title as string | undefined)?.toString().slice(0, 200);
    const content = body.content;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof title === "string") update.title = title;
    if (typeof content === "string") update.content = content;

    const updated = await databases.updateDocument(DB, COL, id, update);

    const scope = normalizeBoardScope((doc as BoardDoc).scope);
    const { category, label } = BOARD_SCOPE_ACTIVITY[scope];
    logActivity({
      category,
      action: "updated",
      title: label,
      description: typeof title === "string" ? title : ((doc as BoardDoc).title ?? "Untitled"),
      entityId: id,
      entityType: "board",
      metadata: { scope },
    }).catch(() => {});

    return Response.json({ board: serialize(updated) });
  } catch (error) {
    return toJson(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  try {
    const doc = await fetchOwned(id, user.email ?? "");
    if (!doc) return ApiError.notFound().toResponse();

    await databases.deleteDocument(DB, COL, id);

    if ((doc as BoardDoc).scope === "ai-venture") {
      logActivity({
        category: "ai_venture",
        action: "deleted",
        title: "Sketch deleted",
        description: (doc as BoardDoc).title || "Untitled",
        entityId: id,
        entityType: "board",
      }).catch(() => {});
    }

    return Response.json({ ok: true });
  } catch (error) {
    return toJson(error);
  }
}
