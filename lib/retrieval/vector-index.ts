import "server-only";
import { databases, ID, Query } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { embedTexts } from "@/lib/knowledge/nvidia";

// Real semantic/cross-section retrieval layer for the app: Knowledge's own
// "semantic" mode previously computed an embedding and threw it away,
// falling back to fulltext (see app/api/knowledge/search/route.ts).
//
// Storage: rows live in Appwrite (collection `search_vectors`, self-provisioned
// below the same way lib/affine/ensure.ts and lib/notifications/ensure.ts do,
// not tracked in appwrite.config.json, created lazily on first write). A prior
// version of this file used an embedded LanceDB file-store, which cannot work
// on Vercel (read-only filesystem outside /tmp, and /tmp isn't shared across
// invocations). Appwrite is already the source of truth for every other
// collection in this app and works identically in dev and on Vercel since
// it's just network calls, no local disk involved.
//
// Similarity: rows are fetched per query (bounded by CANDIDATE_LIMIT) and
// scored in Node with brute-force cosine similarity: no ANN index needed at
// this data scale (a personal workspace, not a bulk dataset).
//
// Every function here degrades to a no-op instead of throwing: retrieval is
// always an enhancement over the existing substring/fulltext search, never a
// hard dependency, matching the posture of lib/knowledge/nvidia.ts.

const DB = APPWRITE.databaseId;
const TABLE = APPWRITE.collections.searchVectors;
const CANDIDATE_LIMIT = 1000;

export type VectorCollection = "knowledge" | "documents" | "notes" | "terminal" | "links";

type AppwriteAttribute = { key: string };

// Stored under the Appwrite attribute name "section" rather than
// "collection": a custom attribute literally named "collection" on this
// project silently fails to round-trip (createDocument's response echoes it
// back, but a subsequent listDocuments never returns it, almost certainly a
// collision with the legacy Databases API's internal `$collectionId`
// concept). "section" mirrors the working precedent in
// lib/affine/ensure.ts's `section` column. The public interface below still
// calls it `collection`. Only the Appwrite-side column name differs.
const ATTRS: Array<{ key: string; size: number; required: boolean }> = [
  { key: "section", size: 32, required: true },
  { key: "doc_id", size: 255, required: true },
  { key: "text", size: 2000, required: true },
  { key: "vector", size: 20000, required: true },
  { key: "updated_at", size: 64, required: true },
];

let ensured = false;

// Newly created attributes report status "processing" for a moment before
// "available". A write attempted in that window is rejected. Poll instead
// of assuming readiness right after creation (same shape as
// waitForCollectionShape() in lib/dashboard/preferences.server.ts).
async function waitForAttributes() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const attributes = await databases.listAttributes(DB, TABLE);
    const available = new Set(
      (attributes.attributes as (AppwriteAttribute & { status?: string })[])
        .filter((a) => a.status === undefined || a.status === "available")
        .map((a) => a.key)
    );
    if (ATTRS.every((a) => available.has(a.key))) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.warn("search_vectors collection shape not fully ready; proceeding anyway");
}

async function ensureSearchVectorsCollection() {
  if (ensured) return;
  try {
    await databases.getCollection(DB, TABLE);
  } catch {
    try {
      await databases.createCollection(DB, TABLE, TABLE, ["read(\"any\")", "write(\"any\")"]);
    } catch {
      // best effort; the write will surface the real error if creation failed
      return;
    }
  }

  try {
    const attributes = await databases.listAttributes(DB, TABLE);
    const existing = new Set((attributes.attributes as AppwriteAttribute[]).map((a) => a.key));
    for (const a of ATTRS) {
      if (existing.has(a.key)) continue;
      try {
        await databases.createStringAttribute(DB, TABLE, a.key, a.size, a.required);
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

async function findExisting(collection: string, docId: string) {
  const res = await databases.listDocuments(DB, TABLE, [
    Query.equal("section", collection),
    Query.equal("doc_id", docId),
    Query.limit(1),
  ]);
  return res.documents[0] ?? null;
}

export async function upsertVector(opts: {
  collection: VectorCollection;
  docId: string;
  text: string;
}): Promise<void> {
  const text = (opts.text || "").trim();
  if (!text) {
    await deleteVector(opts);
    return;
  }

  try {
    const embeddings = await embedTexts([text.slice(0, 6000)], "passage");
    const vector = embeddings?.[0];
    if (!vector) return; // no NVIDIA_API_KEY or embedding failed. Skip silently

    await ensureSearchVectorsCollection();

    const payload = {
      section: opts.collection,
      doc_id: opts.docId,
      text: text.slice(0, 500),
      vector: JSON.stringify(vector),
      updated_at: new Date().toISOString(),
    };

    const existing = await findExisting(opts.collection, opts.docId);
    if (existing) {
      await databases.updateDocument(DB, TABLE, existing.$id, payload);
    } else {
      await databases.createDocument(DB, TABLE, ID.unique(), payload);
    }
  } catch (err) {
    console.warn("upsertVector failed (non-fatal):", err);
  }
}

export async function deleteVector(opts: { collection: string; docId: string }): Promise<void> {
  try {
    await ensureSearchVectorsCollection();
    const existing = await findExisting(opts.collection, opts.docId);
    if (existing) await databases.deleteDocument(DB, TABLE, existing.$id);
  } catch (err) {
    console.warn("deleteVector failed (non-fatal):", err);
  }
}

export type VectorHit = {
  collection: string;
  docId: string;
  text: string;
  score: number;
};

// Cosine distance (1 - cosine similarity): 0 = identical direction, up to 2 =
// opposite. Smaller-is-better, same "smaller is better" convention the old
// LanceDB `_distance` field had, so downstream consumers (app/api/knowledge/
// search/route.ts's `1 / (1 + score)` mapping) don't need to change.
function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 2;
  const similarity = dot / (Math.sqrt(magA) * Math.sqrt(magB));
  return 1 - similarity;
}

export async function searchVector(
  query: string,
  opts?: { collections?: VectorCollection[]; limit?: number }
): Promise<VectorHit[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const embeddings = await embedTexts([q], "query");
    const queryVector = embeddings?.[0];
    if (!queryVector) return [];

    await ensureSearchVectorsCollection();

    const queries = [Query.limit(CANDIDATE_LIMIT)];
    if (opts?.collections?.length) queries.push(Query.equal("section", opts.collections));

    const res = await databases.listDocuments(DB, TABLE, queries);

    const scored = res.documents.map((doc: Record<string, any>) => {
      let docVector: number[] = [];
      try {
        docVector = JSON.parse(doc.vector);
      } catch {
        docVector = [];
      }
      return {
        collection: doc.section as string,
        docId: doc.doc_id as string,
        text: doc.text as string,
        score: cosineDistance(queryVector, docVector),
      };
    });

    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, opts?.limit ?? 20);
  } catch (err) {
    console.warn("searchVector failed (non-fatal):", err);
    return [];
  }
}
