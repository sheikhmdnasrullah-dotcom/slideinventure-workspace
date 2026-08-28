import { databases } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.boards;

const ATTRS: Array<{ key: string; type: string; size?: number; required?: boolean }> = [
  { key: "user_email", type: "string", size: 320, required: true },
  { key: "title", type: "string", size: 255, required: false },
  { key: "content", type: "string", size: 100000, required: false },
  { key: "created_at", type: "string", size: 64, required: false },
  { key: "updated_at", type: "string", size: 64, required: false },
  { key: "scope", type: "string", size: 32, required: false },
];

let ensured = false;

export async function ensureBoardsCollection() {
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
        }
      } catch {
        // attribute may already exist
      }
    }
    ensured = true;
  } catch {
    // best effort; the write will surface the real error if collection creation failed
  }
}
