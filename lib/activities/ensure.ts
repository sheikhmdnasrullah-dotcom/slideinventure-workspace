import "server-only";
import { databases } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.activities;

const ATTRS: Array<{ key: string; type: string; size?: number; required?: boolean }> = [
  { key: "category", type: "string", size: 64, required: false },
  { key: "action", type: "string", size: 64, required: false },
  { key: "title", type: "string", size: 512, required: false },
  { key: "description", type: "string", size: 2000, required: false },
  { key: "entity_id", type: "string", size: 320, required: false },
  { key: "entity_type", type: "string", size: 64, required: false },
  { key: "timestamp", type: "string", size: 64, required: false },
  { key: "metadata", type: "string", size: 65535, required: false },
  { key: "user_email", type: "string", size: 320, required: false },
];

let ensured = false;

// Newly created attributes report status "processing" for a moment before
// "available" — a write attempted in that window is rejected. Poll instead
// of assuming readiness right after creation (same shape as
// waitForCollectionShape() in lib/dashboard/preferences.server.ts).
async function waitForAttributes() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const attributes = await databases.listAttributes(DB, COL);
    const available = new Set(
      (attributes.attributes as { key: string; status?: string }[])
        .filter((a) => a.status === undefined || a.status === "available")
        .map((a) => a.key)
    );
    if (ATTRS.every((a) => available.has(a.key))) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.warn("activities collection shape not fully ready; proceeding anyway");
}

// Same lazy self-provisioning pattern as lib/affine/ensure.ts and
// lib/notifications/ensure.ts: the collection isn't tracked in
// appwrite.config.json, so it's created on first use instead of assumed to
// already exist.
export async function ensureActivitiesCollection() {
  if (ensured) return;
  try {
    await databases.getCollection(DB, COL);
  } catch {
    try {
      await databases.createCollection(DB, COL, COL, [
        "read(\"any\")",
        "write(\"any\")",
      ]);
    } catch {
      // best effort; the write will surface the real error if creation failed
      return;
    }
  }

  try {
    const attributes = await databases.listAttributes(DB, COL);
    const existing = new Set((attributes.attributes as { key: string }[]).map((a) => a.key));
    for (const a of ATTRS) {
      if (existing.has(a.key)) continue;
      try {
        if (a.type === "string") {
          await databases.createStringAttribute(DB, COL, a.key, a.size ?? 255, a.required ?? false);
        }
      } catch {
        // attribute may already exist
      }
    }
    await waitForAttributes();
    ensured = true;
  } catch {
    // best effort; the write will surface the real error if provisioning failed
  }
}
