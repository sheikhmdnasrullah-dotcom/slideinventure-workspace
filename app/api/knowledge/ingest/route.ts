import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { recordVersion } from "@/lib/knowledge/versioning";
import { reindexChunks } from "@/lib/knowledge/reindex";
import { randomUUID } from "node:crypto";
import { KnowledgeItemSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const CreateSchema = KnowledgeItemSchema.omit({ id: true, createdAt: true, updatedAt: true, searchVector: true, embedding: true });

function slugify(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(CreateSchema, body);

  const supabase = createServiceClient();
  const id = `${validated.data.type}-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 6)}`;
  const slug = slugify(validated.data.title);
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("knowledge_items")
    .select("id, type, title, slug, content_path, content_type, body, status, source, author, tags, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (existing) {
    await recordVersion(supabase, id, existing, "ingest", user.email);
  }

  const { error } = await supabase.from("knowledge_items").upsert({
    id,
    ...validated.data,
    slug,
    content_path: `ingest://${id}`,
    updated_at: now,
    created_at: now,
  });

  if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();

  await reindexChunks(supabase, id, validated.data.body ?? "");

  return Response.json({ id, slug, status: "created" }, { status: 201 });
}
