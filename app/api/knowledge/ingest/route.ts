import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { recordVersion } from "@/lib/knowledge/versioning";
import { reindexChunks } from "@/lib/knowledge/reindex";
import { randomUUID } from "node:crypto";
import { KnowledgeItemSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.knowledgeItems;

const CreateSchema = KnowledgeItemSchema.omit({ id: true, createdAt: true, updatedAt: true, searchVector: true, embedding: true });

function slugify(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

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

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(CreateSchema, body);

  const naturalId = `${validated.data.type}-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 6)}`;
  const slug = slugify(validated.data.title);
  const now = new Date().toISOString();

  const existingRes = await databases.listDocuments(DB, COL, [
    Query.equal("item_id", naturalId),
    Query.limit(1),
  ]);

  let docId: string;
  if (existingRes.documents.length > 0) {
    const existing = existingRes.documents[0];
    await recordVersion(existing.$id, existing as unknown as Record<string, unknown>, "ingest", user.email);
    await databases.updateDocument(DB, COL, existing.$id, {
      ...toItemAttrs(validated.data, slug, `ingest://${naturalId}`),
      updated_at: now,
    });
    docId = existing.$id;
  } else {
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      item_id: naturalId,
      ...toItemAttrs(validated.data, slug, `ingest://${naturalId}`),
      created_at: now,
      updated_at: now,
    });
    docId = doc.$id;
  }

  await reindexChunks(docId, validated.data.body ?? "");

  return Response.json({ id: naturalId, slug, status: "created" }, { status: 201 });
}
