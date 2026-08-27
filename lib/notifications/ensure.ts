import { databases } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.notifications;

const ATTRS: Array<{ key: string; type: string; size?: number; required?: boolean }> = [
  { key: "user_email", type: "string", size: 320, required: false },
  { key: "category", type: "string", size: 64, required: false },
  { key: "title", type: "string", size: 512, required: false },
  { key: "description", type: "string", size: 2000, required: false },
  { key: "entity_id", type: "string", size: 320, required: false },
  { key: "entity_type", type: "string", size: 64, required: false },
  { key: "read", type: "boolean", required: false },
  { key: "created_at", type: "string", size: 64, required: false },
  { key: "metadata", type: "string", size: 65535, required: false },
];

let ensured = false;

export async function ensureNotificationsCollection() {
  if (ensured) return;
  try {
    await databases.getCollection(DB, COL);
    ensured = true;
    return;
  } catch {
    // not found, create it
  }
  try {
    await databases.createCollection(DB, COL, COL, [
      "read(\"any\")",
      "write(\"any\")",
    ]);
    for (const a of ATTRS) {
      try {
        if (a.type === "string") {
          await databases.createStringAttribute(DB, COL, a.key, a.size ?? 255, a.required ?? false);
        } else if (a.type === "boolean") {
          await databases.createBooleanAttribute(DB, COL, a.key, a.required ?? false);
        }
      } catch {
        // attribute may already exist
      }
    }
    ensured = true;
  } catch {
    // best effort
  }
}
