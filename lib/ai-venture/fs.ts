import "server-only";
import { ID, Query } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { databases, storage } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { extractFileText } from "@/lib/knowledge/file-extract";
import { linkDocumentToKnowledge, unlinkDocumentFromKnowledge } from "@/lib/knowledge/link-document";

// AI Venture used to be a real folder on the server's local disk
// (`process.cwd()/AI Venture`). On this app's deployment target (Vercel),
// serverless functions have a read-only filesystem — every write there
// throws in production, and even where it doesn't, nothing survives a
// redeploy or is shared across instances. This module replaces that with
// the same Appwrite Storage bucket + `documents` table that Documents
// already uses (workspace="ai-venture", node_type="file"|"folder",
// folder_path holding the virtual path) — one canonical resource, real
// persistence, and every AI-Venture file becomes a real Documents row for
// free instead of a second, disconnected copy.

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.documents;
const BUCKET = "files";
const WORKSPACE = "ai-venture";

export const VENTURE_ROOT_FOLDERS = ["PDF", "Brainstormed Ideas", "Brainstorm Sketches"];

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".tldr", ".json"]);
const PDF_EXTENSIONS = new Set([".pdf"]);

type DocumentRow = Record<string, unknown> & { $id: string };

export type VentureNode = {
  id: string; // documents row $id ("" for a synthetic/implicit folder with no row yet)
  path: string; // "/"-separated virtual path, relative to the AI Venture root
  name: string;
  type: "file" | "folder";
  ext: string | null;
  size: number;
  modifiedAt: string;
  children?: VentureNode[];
};

export class VentureFsError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

function extOf(name: string): string | null {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i).toLowerCase() : null;
}

export function isTextFile(name: string): boolean {
  return TEXT_EXTENSIONS.has(extOf(name) || "");
}

function isPdfFile(name: string): boolean {
  return PDF_EXTENSIONS.has(extOf(name) || "");
}

// Validates and normalizes a virtual path — the only gate between the
// browser and the row/storage layer, so it must reject anything that could
// smuggle a path-traversal-shaped segment through, even though there is no
// real filesystem behind it anymore.
function normalizePath(relativePath: string): string {
  const cleaned = (relativePath || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const segments = cleaned.split("/").filter(Boolean);
  if (segments.length === 0) return "";
  if (segments.some((s) => s === "." || s === "..")) {
    throw new VentureFsError("Invalid path", 400);
  }
  return segments.join("/");
}

function nameOf(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1];
}

function parentOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

async function fetchAllNodes(): Promise<DocumentRow[]> {
  const out: DocumentRow[] = [];
  let cursor: string | undefined;
  for (;;) {
    const queries = [Query.equal("workspace", WORKSPACE), Query.limit(200)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments(DB, COL, queries);
    out.push(...res.documents);
    if (res.documents.length < 200) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return out;
}

async function findRowByPath(path: string): Promise<DocumentRow | null> {
  const res = await databases.listDocuments(DB, COL, [
    Query.equal("workspace", WORKSPACE),
    Query.equal("folder_path", path),
    Query.limit(1),
  ]);
  return res.documents[0] ?? null;
}

async function ensureRootFolders(): Promise<void> {
  for (const folder of VENTURE_ROOT_FOLDERS) {
    try {
      const existing = await findRowByPath(folder);
      if (existing) continue;
      const now = new Date().toISOString();
      await databases.createDocument(DB, COL, ID.unique(), {
        title: folder,
        filename: folder,
        mime_type: "inode/directory",
        size_bytes: 0,
        storage_path: "",
        url: null,
        tags: [],
        status: "active",
        author: null,
        source: "ai-venture",
        workspace: WORKSPACE,
        folder_path: folder,
        node_type: "folder",
        created_at: now,
        updated_at: now,
      });
    } catch {
      // best-effort; listTree still works if a root folder row is missing
    }
  }
}

function ensureParentChain(nodeMap: Map<string, VentureNode>, root: VentureNode, parentPath: string) {
  if (!parentPath || nodeMap.has(parentPath)) return;
  const parts = parentPath.split("/");
  let acc = "";
  for (const part of parts) {
    const path = acc ? `${acc}/${part}` : part;
    if (!nodeMap.has(path)) {
      const node: VentureNode = {
        id: "",
        path,
        name: part,
        type: "folder",
        ext: null,
        size: 0,
        modifiedAt: new Date().toISOString(),
        children: [],
      };
      nodeMap.set(path, node);
      const parent = nodeMap.get(acc) || root;
      parent.children = parent.children || [];
      parent.children.push(node);
    }
    acc = path;
  }
}

function sortChildrenRecursive(node: VentureNode) {
  if (!node.children) return;
  node.children.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1));
  node.children.forEach(sortChildrenRecursive);
}

function buildTree(rows: DocumentRow[]): VentureNode {
  const nodeMap = new Map<string, VentureNode>();
  const root: VentureNode = {
    id: "",
    path: "",
    name: "AI Venture",
    type: "folder",
    ext: null,
    size: 0,
    modifiedAt: new Date().toISOString(),
    children: [],
  };
  nodeMap.set("", root);

  const sorted = [...rows].sort(
    (a, b) => (a.folder_path || "").split("/").length - (b.folder_path || "").split("/").length
  );

  for (const row of sorted) {
    const p = row.folder_path as string | undefined;
    if (!p) continue;
    const parent = parentOf(p);
    ensureParentChain(nodeMap, root, parent);

    const isFolder = row.node_type === "folder";
    const name = row.filename || nameOf(p);
    const node: VentureNode = {
      id: row.$id,
      path: p,
      name,
      type: isFolder ? "folder" : "file",
      ext: isFolder ? null : extOf(name),
      size: row.size_bytes || 0,
      modifiedAt: row.updated_at || row.created_at,
      children: isFolder ? [] : undefined,
    };
    nodeMap.set(p, node);
    const parentNode = nodeMap.get(parent) || root;
    parentNode.children = parentNode.children || [];
    parentNode.children.push(node);
  }

  sortChildrenRecursive(root);
  return root;
}

export async function listTree(): Promise<VentureNode> {
  await ensureRootFolders();
  const rows = await fetchAllNodes();
  return buildTree(rows);
}

export async function readFileContent(
  relativePath: string
): Promise<{ content: string; name: string; size: number; modifiedAt: string }> {
  const p = normalizePath(relativePath);
  const row = await findRowByPath(p);
  if (!row) throw new VentureFsError("File not found", 404);
  if (row.node_type === "folder") throw new VentureFsError("Not a file", 400);

  const name = row.filename || nameOf(p);
  if (!isTextFile(name) && !isPdfFile(name)) throw new VentureFsError("Unsupported file type", 415);

  if (isPdfFile(name)) {
    // PDFs stream their raw bytes via /api/ai-venture/file/raw instead.
    return { content: "", name, size: row.size_bytes || 0, modifiedAt: row.updated_at };
  }

  let content = "";
  if (row.storage_path) {
    try {
      const buf = await storage.getFileDownload(BUCKET, row.storage_path);
      content = Buffer.from(buf).toString("utf-8");
    } catch {
      content = "";
    }
  }
  return { content, name, size: row.size_bytes || 0, modifiedAt: row.updated_at };
}

async function replaceStorageContent(
  existingStoragePath: string | null | undefined,
  buffer: Buffer,
  filename: string
): Promise<string> {
  if (existingStoragePath) {
    try {
      await storage.deleteFile(BUCKET, existingStoragePath);
    } catch {
      // best-effort; a stale orphaned blob is harmless
    }
  }
  const fileId = ID.unique();
  await storage.createFile(BUCKET, fileId, InputFile.fromBuffer(buffer, filename));
  return fileId;
}

// Best-effort: keep this file's Knowledge mirror in sync after a save.
// Never blocks or fails the caller.
async function reindexIfLinkable(row: DocumentRow, name: string, buffer: Buffer) {
  try {
    if (!isTextFile(name) && !isPdfFile(name)) return;
    if (extOf(name) === ".tldr" || extOf(name) === ".json") return; // canvas snapshots, not readable text
    const file = new File([new Uint8Array(buffer)], name);
    const extracted = await extractFileText(file);
    if (!extracted.text) return;
    await linkDocumentToKnowledge({
      documentId: row.$id,
      title: row.title || name,
      text: extracted.text,
      source: "ai-venture",
      existingKnowledgeItemId: row.knowledge_item_id || null,
    });
  } catch (err) {
    console.warn("AI Venture knowledge indexing skipped for", name, err);
  }
}

export async function writeFileContent(
  relativePath: string,
  content: string,
  encoding: "utf-8" | "base64" = "utf-8"
): Promise<void> {
  const p = normalizePath(relativePath);
  const name = nameOf(p);
  if (!isTextFile(name) && !isPdfFile(name)) {
    throw new VentureFsError("Only .md, .txt, .pdf, .tldr and .json files can be saved", 415);
  }

  const buffer = encoding === "base64" ? Buffer.from(content, "base64") : Buffer.from(content, "utf-8");
  const mimeMap: Record<string, string> = {
    ".pdf": "application/pdf",
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".json": "application/json",
    ".tldr": "application/json",
  };
  const now = new Date().toISOString();
  const existing = await findRowByPath(p);

  const fileId = await replaceStorageContent(existing?.storage_path, buffer, name);

  let row: DocumentRow;
  if (existing) {
    await databases.updateDocument(DB, COL, existing.$id, {
      storage_path: fileId,
      size_bytes: buffer.byteLength,
      mime_type: mimeMap[extOf(name) || ""] || "application/octet-stream",
      updated_at: now,
    });
    row = { ...existing, storage_path: fileId, size_bytes: buffer.byteLength };
  } else {
    const parent = parentOf(p);
    if (parent) await ensureFolderRow(parent);
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      title: name,
      filename: name,
      mime_type: mimeMap[extOf(name) || ""] || "application/octet-stream",
      size_bytes: buffer.byteLength,
      storage_path: fileId,
      url: null,
      tags: [],
      status: "active",
      author: null,
      source: "ai-venture",
      workspace: WORKSPACE,
      folder_path: p,
      node_type: "file",
      created_at: now,
      updated_at: now,
    });
    row = doc;
  }

  await reindexIfLinkable(row, name, buffer);
}

async function ensureFolderRow(path: string): Promise<void> {
  const existing = await findRowByPath(path);
  if (existing) return;
  const parent = parentOf(path);
  if (parent) await ensureFolderRow(parent);
  const now = new Date().toISOString();
  try {
    await databases.createDocument(DB, COL, ID.unique(), {
      title: nameOf(path),
      filename: nameOf(path),
      mime_type: "inode/directory",
      size_bytes: 0,
      storage_path: "",
      url: null,
      tags: [],
      status: "active",
      author: null,
      source: "ai-venture",
      workspace: WORKSPACE,
      folder_path: path,
      node_type: "folder",
      created_at: now,
      updated_at: now,
    });
  } catch {
    // best-effort; a duplicate create races here are harmless (folder is virtual)
  }
}

export async function createEntry(relativePath: string, type: "file" | "folder"): Promise<void> {
  const p = normalizePath(relativePath);
  if (!p) throw new VentureFsError("Invalid path", 400);
  const existing = await findRowByPath(p);
  if (existing) throw new VentureFsError("Already exists", 409);

  if (type === "folder") {
    await ensureFolderRow(p);
    return;
  }

  const name = nameOf(p);
  if (!isTextFile(name) && !isPdfFile(name)) {
    throw new VentureFsError("Only .md, .txt, .pdf, .tldr and .json files can be created", 415);
  }
  await writeFileContent(p, "", "utf-8");
}

export async function moveEntry(fromRelative: string, toRelative: string): Promise<void> {
  const from = normalizePath(fromRelative);
  const to = normalizePath(toRelative);
  const row = await findRowByPath(from);
  if (!row) throw new VentureFsError("Source not found", 404);
  if (await findRowByPath(to)) throw new VentureFsError("Destination already exists", 409);

  const now = new Date().toISOString();
  await databases.updateDocument(DB, COL, row.$id, {
    folder_path: to,
    title: nameOf(to),
    filename: row.node_type === "folder" ? nameOf(to) : row.filename,
    updated_at: now,
  });

  if (row.node_type === "folder") {
    const prefix = `${from}/`;
    const rows = await fetchAllNodes();
    for (const child of rows) {
      const childPath = child.folder_path as string | undefined;
      if (!childPath || !childPath.startsWith(prefix)) continue;
      const newChildPath = to + childPath.slice(from.length);
      await databases.updateDocument(DB, COL, child.$id, {
        folder_path: newChildPath,
        updated_at: now,
      });
    }
  }
}

export async function readFileStream(relativePath: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  size: number;
  contentType: string;
  filename: string;
}> {
  const p = normalizePath(relativePath);
  const row = await findRowByPath(p);
  if (!row) throw new VentureFsError("File not found", 404);
  if (row.node_type === "folder") throw new VentureFsError("Not a file", 400);
  if (!row.storage_path) throw new VentureFsError("File has no content", 404);

  const buf = await storage.getFileDownload(BUCKET, row.storage_path);
  const bytes = new Uint8Array(buf);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

  const contentTypeMap: Record<string, string> = {
    ".pdf": "application/pdf",
    ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".tldr": "application/json; charset=utf-8",
  };
  const ext = extOf(row.filename || nameOf(p)) || "";

  return {
    stream,
    size: bytes.byteLength,
    contentType: contentTypeMap[ext] || row.mime_type || "application/octet-stream",
    filename: row.filename || nameOf(p),
  };
}

export async function deleteEntry(relativePath: string): Promise<void> {
  const p = normalizePath(relativePath);
  if (!p) throw new VentureFsError("Cannot delete the root folder", 400);
  const row = await findRowByPath(p);
  if (!row) throw new VentureFsError("Not found", 404);

  const toDelete: DocumentRow[] = [row];
  if (row.node_type === "folder") {
    const prefix = `${p}/`;
    const rows = await fetchAllNodes();
    for (const child of rows) {
      const childPath = child.folder_path as string | undefined;
      if (childPath && childPath.startsWith(prefix)) toDelete.push(child);
    }
  }

  for (const doc of toDelete) {
    if (doc.storage_path) {
      try {
        await storage.deleteFile(BUCKET, doc.storage_path);
      } catch {
        // best-effort
      }
    }
    await unlinkDocumentFromKnowledge(doc.knowledge_item_id);
    try {
      await databases.deleteDocument(DB, COL, doc.$id);
    } catch {
      // best-effort
    }
  }
}
