"use server";

import { revalidatePath } from "next/cache";
import { requireUser, createServiceClient } from "@/lib/supabase/server";
import { recordVersion } from "@/lib/knowledge/versioning";
import { reindexChunks } from "@/lib/knowledge/reindex";

const STRATEGY_TYPES = ["decision", "plan"];
const STRATEGY_STATUSES = ["proposed", "in_progress", "confirmed", "deprecated"];

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function updateCardStatus(id: string, status: string) {
  const user = await requireUser();
  if (!STRATEGY_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("knowledge_items")
    .select("id, type, title, slug, content_path, content_type, body, status, source, author, tags, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (existing) {
    await recordVersion(supabase, id, existing, "strategy-board", user.email);
  }

  const { error } = await supabase
    .from("knowledge_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    throw new Error(`Status update failed: ${error.message}`);
  }

  revalidatePath("/strategy");
}

export async function createCard(formData: FormData) {
  const user = await requireUser();

  const title = ((formData.get("title") as string) || "").trim();
  const type = ((formData.get("type") as string) || "decision").trim();
  const body = ((formData.get("body") as string) || "").trim();
  const source = ((formData.get("source") as string) || "Strategy board").trim();

  if (!title) {
    throw new Error("Title is required.");
  }
  if (!STRATEGY_TYPES.includes(type)) {
    throw new Error(`Invalid type: ${type}`);
  }

  const supabase = createServiceClient();
  const baseSlug = slugify(title);

  let slug = baseSlug;
  for (let n = 2; ; n++) {
    const { data } = await supabase
      .from("knowledge_items")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) break;
    slug = `${baseSlug}-${n}`;
  }

  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from("knowledge_items")
    .select("id", { count: "exact", head: true })
    .eq("type", type)
    .like("id", `${type}-${today}-%`);
  const id = `${type}-${today}-${String((count ?? 0) + 1).padStart(3, "0")}`;

  const { error } = await supabase.from("knowledge_items").insert({
    id,
    type,
    title,
    slug,
    content_path: `board/${id}`,
    content_type: "board-card",
    body,
    status: "proposed",
    source,
    author: user.email,
    tags: [],
  });
  if (error) {
    throw new Error(`Database insert failed: ${error.message}`);
  }

  await reindexChunks(supabase, id, body);

  revalidatePath("/strategy");
}
