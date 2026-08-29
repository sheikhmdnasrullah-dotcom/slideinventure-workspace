import "server-only";
import { databases } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.workSessions ?? "work_sessions";

const ATTRS: Array<{ key: string; type: "string" | "integer"; size?: number; required?: boolean }> = [
  { key: "user_email", type: "string", size: 320, required: false },
  { key: "start_time", type: "string", size: 64, required: false },
  { key: "end_time", type: "string", size: 64, required: false },
  { key: "duration", type: "integer", required: false },
  { key: "date", type: "string", size: 32, required: false },
  { key: "project", type: "string", size: 128, required: false },
  { key: "note", type: "string", size: 2000, required: false },
  { key: "source", type: "string", size: 64, required: false },
  { key: "metadata", type: "string", size: 65535, required: false },
  { key: "created_at", type: "string", size: 64, required: false },
  { key: "updated_at", type: "string", size: 64, required: false },
];

let ensured = false;

async function waitForAttributes() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const attributes = await databases.listAttributes(DB, COL);
      const available = new Set(
        (attributes.attributes as { key: string; status?: string }[])
          .filter((a) => a.status === undefined || a.status === "available")
          .map((a) => a.key)
      );
      if (ATTRS.every((a) => available.has(a.key))) return;
    } catch {
      // Continue polling
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.warn("work_sessions collection shape not fully ready; proceeding anyway");
}

export async function ensureWorkSessionsCollection() {
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
        } else if (a.type === "integer") {
          await databases.createIntegerAttribute(DB, COL, a.key, a.required ?? false);
        }
      } catch {
        // attribute may already exist
      }
    }
    await waitForAttributes();
    ensured = true;
  } catch (err) {
    console.warn("Error provisioning work_sessions collection:", err);
  }
}
