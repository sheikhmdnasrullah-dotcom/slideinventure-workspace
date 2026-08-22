import { createServiceClient } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { verifyInternalSecret } from "@/lib/auth/verify-internal-secret";
import { recordVersion } from "@/lib/knowledge/versioning";
import { reindexChunks } from "@/lib/knowledge/reindex";
import { z } from "zod";
import { KnowledgeItemSchema } from "@/lib/api/schemas";

const PublishSchema = KnowledgeItemSchema.omit({ createdAt: true, updatedAt: true, searchVector: true, embedding: true });

export async function POST(request: Request) {
  if (!verifyInternalSecret(request)) {
    return toJson(ApiError.unauthorized("UNAUTHORIZED", "Invalid internal secret"));
  }

  const body = await request.json().catch(() => ({}));
  const validated = PublishSchema.safeParse(body);

  if (!validated.success) {
    return toJson(ApiError.badRequest("VALIDATION_ERROR", "Invalid request body", {
      issues: validated.error.issues,
    }));
  }

  const { id, type, title, body: content, status = "proposed", source = "terminal", author = "terminal", tags = [] } = validated.data;

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("knowledge_items")
    .select("id, type, title, slug, content_path, content_type, body, status, source, author, tags, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (existing) {
    await recordVersion(supabase, id, existing, "publish", author);
  }

  const { error } = await supabase.from("knowledge_items").upsert({
    id,
    type,
    title,
    slug: id,
    content_path: `terminal://${id}`,
    body: content ?? "",
    status,
    source,
    author,
    tags,
    updated_at: new Date().toISOString(),
  });

  if (error) return toJson(ApiError.internal("DB_ERROR", error.message));

  try {
    await reindexChunks(supabase, id, content ?? "");
  } catch (err) {
    return toJson(ApiError.internal("REINDEX_ERROR", (err as Error).message));
  }

  return Response.json({ id, status: "created" }, { status: 201 });
}
