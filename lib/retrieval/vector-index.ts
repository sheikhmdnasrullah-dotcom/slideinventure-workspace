import "server-only";
import * as lancedb from "@lancedb/lancedb";
import { embedTexts } from "@/lib/knowledge/nvidia";

// A single embedded LanceDB store (local files, no separate service) acting
// as the real semantic/cross-section retrieval layer this app was missing —
// Knowledge's own "semantic" mode previously computed an embedding and threw
// it away, falling back to fulltext (see app/api/knowledge/search/route.ts).
// Every function here degrades to a no-op instead of throwing: retrieval is
// always an enhancement over the existing substring/fulltext search, never a
// hard dependency, matching the posture of lib/knowledge/nvidia.ts.

const DIM = 1024;
const TABLE = "search_index";

export type VectorCollection = "knowledge" | "documents" | "notes" | "terminal" | "links";

let connection: Promise<lancedb.Connection> | null = null;
let table: Promise<lancedb.Table | null> | null = null;

function dbPath(): string {
  return process.env.LANCEDB_PATH || "./.lancedb-data";
}

function getConnection(): Promise<lancedb.Connection> {
  if (!connection) connection = lancedb.connect(dbPath());
  return connection;
}

function getTable(): Promise<lancedb.Table | null> {
  if (table) return table;
  table = (async () => {
    try {
      const db = await getConnection();
      const names = await db.tableNames();
      if (names.includes(TABLE)) return await db.openTable(TABLE);

      // Seed with one throwaway row so LanceDB can infer a concrete schema
      // (float32 vector of the right width), then remove it immediately.
      const seeded = await db.createTable(TABLE, [
        { id: "__seed__", collection: "seed", doc_id: "seed", text: "", vector: new Array(DIM).fill(0) },
      ]);
      await seeded.delete("id = '__seed__'");
      return seeded;
    } catch (err) {
      console.warn("vector-index: table unavailable (non-fatal):", err);
      return null;
    }
  })();
  return table;
}

function rowId(collection: string, docId: string): string {
  return `${collection}:${docId}`;
}

// Appwrite $ids are alphanumeric and our own collection tags are static
// literals, but escape defensively since ids are interpolated into a SQL-like
// delete predicate.
function escapeId(id: string): string {
  return id.replace(/'/g, "''");
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
    if (!vector) return; // no NVIDIA_API_KEY or embedding failed — skip silently

    const t = await getTable();
    if (!t) return;

    const id = rowId(opts.collection, opts.docId);
    await t.delete(`id = '${escapeId(id)}'`);
    await t.add([
      {
        id,
        collection: opts.collection,
        doc_id: opts.docId,
        text: text.slice(0, 500),
        vector,
      },
    ]);
  } catch (err) {
    console.warn("upsertVector failed (non-fatal):", err);
  }
}

export async function deleteVector(opts: { collection: string; docId: string }): Promise<void> {
  try {
    const t = await getTable();
    if (!t) return;
    await t.delete(`id = '${escapeId(rowId(opts.collection, opts.docId))}'`);
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

export async function searchVector(
  query: string,
  opts?: { collections?: VectorCollection[]; limit?: number }
): Promise<VectorHit[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const embeddings = await embedTexts([q], "query");
    const vector = embeddings?.[0];
    if (!vector) return [];

    const t = await getTable();
    if (!t) return [];

    let search = t.search(vector).limit(opts?.limit ?? 20);
    if (opts?.collections?.length) {
      const list = opts.collections.map((c) => `'${c}'`).join(", ");
      search = search.where(`collection IN (${list})`);
    }

    const rows = await search.toArray();
    return rows
      .filter((r: any) => r.collection !== "seed")
      .map((r: any) => ({
        collection: r.collection as string,
        docId: r.doc_id as string,
        text: r.text as string,
        score: r._distance as number,
      }));
  } catch (err) {
    console.warn("searchVector failed (non-fatal):", err);
    return [];
  }
}
