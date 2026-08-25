import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { verifyInternalSecret } from "@/lib/auth/verify-internal-secret";
import { recordVersion } from "@/lib/knowledge/versioning";
import { reindexChunks } from "@/lib/knowledge/reindex";
import { z } from "zod";
import { KnowledgeItemSchema } from "@/lib/api/schemas";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.knowledgeItems;

const PublishSchema = KnowledgeItemSchema.omit({ createdAt: true, updatedAt: true, searchVector: true, embedding: true });

function toItemAttrs(data: Record<string, any>, slug: string, contentPath: string) {
  return {
    type: data.type,
    title: data.title,
    slug,
    content_path: contentPath,
    body: data.body ?? "",
    status: data.status ?? "proposed",
    source: data.source ?? null,
    author: data.author ?? null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    content_type: data.contentType ?? "markdown",
  };
}

export async function POST(request: Request) {
  if (!verifyInternalSecret(request)) {
    return ApiError.unauthorized("UNAUTHORIZED", "Invalid internal secret").toResponse();
  }

  const body = await request.json().catch(() => ({}));
  const validated = PublishSchema.safeParse(body);

  if (!validated.success) {
    return ApiError.badRequest("VALIDATION_ERROR", "Invalid request body", {
      issues: validated.error.issues,
    }).toResponse();
  }

  const { id, type, title, body: content, status = "proposed", source = "terminal", author = "terminal", tags = [] } = validated.data;

  const res = await databases.listDocuments(DB, COL, [
    Query.equal("item_id", id),
    Query.limit(1),
  ]);

  let docId: string;
  if (res.documents.length > 0) {
    const existing = res.documents[0];
    await recordVersion(existing.$id, existing as unknown as Record<string, unknown>, "publish", author);
    await databases.updateDocument(DB, COL, existing.$id, {
      ...toItemAttrs({ type, title, body: content, status, source, author, tags }, id, `terminal://${id}`),
      updated_at: new Date().toISOString(),
    });
    docId = existing.$id;
  } else {
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      item_id: id,
      ...toItemAttrs({ type, title, body: content, status, source, author, tags }, id, `terminal://${id}`),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    docId = doc.$id;
  }

  try {
    await reindexChunks(docId, content ?? "");
  } catch (err) {
    return ApiError.internal("REINDEX_ERROR", (err as Error).message).toResponse();
  }

  return Response.json({ id, status: "created" }, { status: 201 });
}
