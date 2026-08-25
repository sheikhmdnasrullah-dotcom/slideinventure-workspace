// @ts-nocheck
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { recordVersion } from "@/lib/knowledge/versioning";
import { reindexChunks } from "@/lib/knowledge/reindex";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.knowledgeItems;

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

  const res = await databases.listDocuments(DB, COL, [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const existing = res.documents[0];

  if (existing) {
    await recordVersion(id, existing, "strategy-board", user.email);
  }

  await databases.updateDocument(DB, COL, id, {
    status,
    updated_at: new Date().toISOString(),
  });

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

  const baseSlug = slugify(title);

  let slug = baseSlug;
  for (let n = 2; ; n++) {
    const dup = await databases.listDocuments(DB, COL, [
      Query.equal("slug", slug),
      Query.limit(1),
    ]);
    if (dup.documents.length === 0) break;
    if (n > 1000) {
      throw new Error("Could not generate a unique slug after 1000 attempts.");
    }
    slug = `${baseSlug}-${n}`;
  }

  const today = new Date().toISOString().slice(0, 10);
  const countRes = await databases.listDocuments(DB, COL, [
    Query.equal("type", type),
    Query.startsWith("$id", `${type}-${today}-`),
    Query.limit(1),
  ]);
  const id = `${type}-${today}-${String((countRes.total ?? 0) + 1).padStart(3, "0")}`;

  const now = new Date().toISOString();
  await databases.createDocument(DB, COL, ID.custom(id), {
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
    created_at: now,
    updated_at: now,
  });

  await reindexChunks(id, body);

  revalidatePath("/strategy");
}
