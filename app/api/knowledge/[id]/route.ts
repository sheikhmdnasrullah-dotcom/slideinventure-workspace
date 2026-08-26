import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { reindexChunks } from "@/lib/knowledge/reindex";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.knowledgeItems;

function serialize(doc: Record<string, unknown> & { $id: string }) {
  return {
    id: doc.$id,
    slug: doc.slug,
    type: doc.type,
    title: doc.title,
    body: doc.body ?? "",
    status: doc.status,
    source: doc.source ?? null,
    author: doc.author ?? null,
    tags: doc.tags ?? [],
    document_id: doc.document_id ?? null,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

async function fetchItem(id: string) {
  return databases.getDocument(DB, COL, id).catch(() => null);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  const doc = await fetchItem(id);
  if (!doc) return ApiError.notFound("KNOWLEDGE_ITEM_NOT_FOUND", "Knowledge item not found").toResponse();
  return Response.json(serialize(doc as Record<string, unknown> & { $id: string }));
}

// Notes/SOPs/System Docs all go through this one PUT — every field is
// optional so a title-only rename and a body-only autosave are both valid,
// cheap requests instead of needing the full record round-tripped.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 60, windowMs: 60_000, identifier: `knowledge-update:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  const existing = await fetchItem(id);
  if (!existing) return ApiError.notFound("KNOWLEDGE_ITEM_NOT_FOUND", "Knowledge item not found").toResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const { title, content, category, tags, status } = body as {
      title?: string;
      content?: string;
      category?: string;
      tags?: string[];
      status?: string;
    };

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) patch.title = title.trim() || (existing as Record<string, unknown>).title;
    if (content !== undefined) patch.body = content;
    if (category !== undefined) patch.type = category;
    if (tags !== undefined) patch.tags = tags;
    if (status !== undefined) patch.status = status;

    await databases.updateDocument(DB, COL, id, patch);

    if (content !== undefined) {
      await reindexChunks(id, content);
    }

    const updated = await fetchItem(id);
    return Response.json(serialize(updated as Record<string, unknown> & { $id: string }));
  } catch (error) {
    return toJson(error);
  }
}

// Deleting a Knowledge item only removes its index entry — if it mirrors a
// Documents/AI-Venture file (document_id set), that canonical file and its
// storage bytes are untouched; deleting the file itself happens from
// Documents/AI Venture, which cascades to remove this mirror in turn.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000, identifier: `knowledge-delete:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  const existing = await fetchItem(id);
  if (!existing) return ApiError.notFound("KNOWLEDGE_ITEM_NOT_FOUND", "Knowledge item not found").toResponse();

  try {
    await reindexChunks(id, "");
    await databases.deleteDocument(DB, COL, id);
    return Response.json({ id, status: "deleted" });
  } catch (error) {
    return toJson(error);
  }
}
