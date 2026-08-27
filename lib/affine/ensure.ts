import { databases } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.affineWorkspaces;

const ATTRS: Array<{ key: string; type: string; size?: number; required?: boolean }> = [
  { key: "section", type: "string", size: 64, required: true },
  { key: "title", type: "string", size: 512, required: false },
  { key: "snapshot", type: "string", size: 65535, required: false },
  { key: "user_email", type: "string", size: 320, required: false },
  { key: "created_at", type: "string", size: 64, required: false },
  { key: "updated_at", type: "string", size: 64, required: false },
];

let ensured = false;

export async function ensureAffineCollection() {
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
