import { databases } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.researchLabItems;

const ATTRS: Array<{ key: string; size: number; required?: boolean }> = [
  { key: "user_email", size: 320, required: true },
  { key: "source", size: 32, required: true },
  { key: "source_ref", size: 512, required: true },
  { key: "title", size: 255, required: false },
  { key: "summary", size: 4000, required: false },
  { key: "reference", size: 1000, required: false },
  { key: "created_at", size: 64, required: false },
  { key: "updated_at", size: 64, required: false },
];

let ensured = false;

export async function ensureResearchLabCollection() {
  if (ensured) return;
  try {
    await databases.getCollection(DB, COL);
    ensured = true;
    return;
  } catch {
    // not found, create it
  }
  try {
    await databases.createCollection(DB, COL, COL, ["read(\"any\")", "write(\"any\")"]);
    for (const a of ATTRS) {
      try {
        await databases.createStringAttribute(DB, COL, a.key, a.size, a.required ?? false);
      } catch {
        // attribute may already exist
      }
    }
    ensured = true;
  } catch {
    // best effort; the write will surface the real error if collection creation failed
  }
}
