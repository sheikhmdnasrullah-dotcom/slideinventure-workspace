import { createServiceClient } from "@/lib/supabase/server";
import { verifyInternalSecret } from "@/lib/auth/verify-internal-secret";
import { recordVersion } from "@/lib/knowledge/versioning";
import { reindexChunks } from "@/lib/knowledge/reindex";

export async function POST(request: Request) {
  if (!verifyInternalSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const body = await request.json().catch(() => ({}));

  const { id, type, title, body: content, status = "proposed", source = "terminal", author = "terminal", tags = [] } = body as {
    id?: string;
    type?: string;
    title?: string;
    body?: string;
    status?: string;
    source?: string;
    author?: string;
    tags?: string[];
  };

  if (!id || !type || !title) {
    return Response.json({ error: "id, type, and title are required" }, { status: 400 });
  }

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

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  try {
    await reindexChunks(supabase, id, content ?? "");
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }

  return Response.json({ id, status: "created" }, { status: 201 });
}
