import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import { recordVersion } from "@/lib/knowledge/versioning";
import { reindexChunks } from "@/lib/knowledge/reindex";
import { randomUUID } from "node:crypto";

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    const {
      type,
      title,
      body: content,
      status = "proposed",
      source = "dashboard",
      author = "user",
      tags = [],
    } = body as {
      id?: string;
      type?: string;
      title?: string;
      body?: string;
      status?: string;
      source?: string;
      author?: string;
      tags?: string[];
    };

    if (!type || !title) {
      return Response.json({ error: "type and title are required" }, { status: 400 });
    }

    const id = (body as { id?: string }).id ?? `${type}-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 6)}`;
    const slug = slugify(title);

    const supabase = createServiceClient();

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
      type,
      title,
      slug,
      content_path: `ingest://${id}`,
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

    await reindexChunks(supabase, id, content ?? "");

    return Response.json({ id, slug, status: "created" }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
