import { Client, Databases, Storage, ID, Query, Permission, Role } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { readFileSync, writeFileSync, mkdirSync, watch, existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const PROJECT = process.env.APPWRITE_PROJECT_ID || "";
const API_KEY = process.env.APPWRITE_API_KEY || "";
const DB = process.env.APPWRITE_DATABASE_ID || "workspace";
const COL = "documents";
const BUCKET = "files";
const WORKSPACE = "ai-venture";

if (!API_KEY) {
  console.error("APPWRITE_API_KEY is not set. Run with: tsx --env-file=.env.local scripts/venture-paper.ts ...");
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const databases = new Databases(client);
const storage = new Storage(client);

const MIME: Record<string, string> = {
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".json": "application/json",
  ".tldr": "application/json",
  ".csv": "text/csv",
  ".pdf": "application/pdf",
};

const TEXT_EXT = new Set([".md", ".txt", ".tldr", ".json", ".csv"]);

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i).toLowerCase() : "";
}
function nameOf(path: string) {
  const parts = path.split("/");
  return parts[parts.length - 1];
}
function parentOf(path: string) {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}
function norm(path: string) {
  const cleaned = (path || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const segs = cleaned.split("/").filter(Boolean);
  if (segs.some((s) => s === "." || s === "..")) throw new Error("Invalid path");
  return segs.join("/");
}

async function findRow(path: string) {
  const res = await databases.listDocuments(DB, COL, [
    Query.equal("workspace", WORKSPACE),
    Query.equal("folder_path", path),
    Query.limit(1),
  ]);
  return res.documents[0] || null;
}

async function ensureFolderRow(path: string) {
  const existing = await findRow(path);
  if (existing) return;
  const parent = parentOf(path);
  if (parent) await ensureFolderRow(parent);
  const now = new Date().toISOString();
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
}

async function listTree(): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | undefined;
  for (;;) {
    const queries = [Query.equal("workspace", WORKSPACE), Query.limit(200)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments(DB, COL, queries);
    for (const d of res.documents) out.push(`${d.folder_path}  (${d.node_type})`);
    if (res.documents.length < 200) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return out.sort();
}

async function pull(path: string, localPath: string) {
  const p = norm(path);
  const row: any = await findRow(p);
  if (!row) throw new Error(`Not found: ${p}`);
  if (row.node_type === "folder") throw new Error(`Is a folder: ${p}`);
  let content = "";
  if (row.storage_path) {
    const buf = await storage.getFileDownload(BUCKET, row.storage_path);
    content = Buffer.from(buf as any).toString("utf-8");
  }
  mkdirSync(dirname(localPath), { recursive: true });
  writeFileSync(localPath, content, "utf-8");
  console.log(`Pulled ${p} -> ${localPath} (${content.length} chars)`);
}

async function push(localPath: string, remotePath?: string) {
  const abs = resolve(localPath);
  if (!existsSync(abs)) throw new Error(`Local file missing: ${abs}`);
  const buf = readFileSync(abs);
  const p = norm(remotePath || defaultRemote(abs));
  const name = nameOf(p);
  const ext = extOf(name);
  if (!TEXT_EXT.has(ext)) throw new Error(`Unsupported type: ${ext}`);
  const existing: any = await findRow(p);
  const fileId = ID.unique();
  await storage.createFile(BUCKET, fileId, InputFile.fromBuffer(buf, name), [Permission.read(Role.any())]);
  const now = new Date().toISOString();
  const payload = {
    storage_path: fileId,
    size_bytes: buf.byteLength,
    mime_type: MIME[ext] || "application/octet-stream",
    url: `${ENDPOINT}/storage/buckets/${BUCKET}/files/${fileId}/view?project=${PROJECT}`,
    updated_at: now,
  };
  if (existing) {
    if (existing.storage_path) {
      try { await storage.deleteFile(BUCKET, existing.storage_path); } catch {}
    }
    await databases.updateDocument(DB, COL, existing.$id, payload);
    console.log(`Pushed ${p} (updated ${existing.$id})`);
  } else {
    const parent = parentOf(p);
    if (parent) await ensureFolderRow(parent);
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      title: name,
      filename: name,
      mime_type: MIME[ext] || "application/octet-stream",
      size_bytes: buf.byteLength,
      storage_path: fileId,
      url: payload.url,
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
    console.log(`Pushed ${p} (created ${doc.$id})`);
  }
}

// default remote path: strip the local "workspace" mirror prefix, keep AI Venture-relative
function defaultRemote(abs: string): string {
  const base = resolve(process.cwd(), "AI Venture/workspace");
  const rel = relative(base, abs);
  if (rel.startsWith("..")) return nameOf(abs);
  return rel.split(/[\\/]/).join("/");
}

const WORKSPACE_MIRROR = resolve(process.cwd(), "AI Venture/workspace");

async function watchDir() {
  mkdirSync(WORKSPACE_MIRROR, { recursive: true });
  console.log(`Watching ${WORKSPACE_MIRROR} — edits sync to AI Venture dashboard`);
  const debounce = new Map<string, NodeJS.Timeout>();
  const handler = (file: string) => {
    const abs = resolve(WORKSPACE_MIRROR, file);
    if (!existsSync(abs) || !statSync(abs).isFile()) return;
    if (debounce.has(abs)) clearTimeout(debounce.get(abs)!);
    debounce.set(
      abs,
      setTimeout(() => {
        push(abs).then(() => console.log(`Synced ${relative(WORKSPACE_MIRROR, abs)}`)).catch((e) => console.error(e.message));
      }, 600)
    );
  };
  watch(WORKSPACE_MIRROR, { recursive: true }, (_e, f) => f && handler(f.toString()));
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  switch (cmd) {
    case "list":
      console.log((await listTree()).join("\n") || "(empty)");
      break;
    case "pull":
      if (!a) throw new Error("usage: pull <remotePath> [localPath]");
      await pull(a, b || resolve(WORKSPACE_MIRROR, a));
      break;
    case "push":
      if (!a) throw new Error("usage: push <localPath> [remotePath]");
      await push(a, b);
      break;
    case "new": {
      if (!a) throw new Error("usage: new <remotePath> [initialContent]");
      const local = resolve(WORKSPACE_MIRROR, a);
      mkdirSync(dirname(local), { recursive: true });
      writeFileSync(local, b ?? "# New Project Paper\n\n", "utf-8");
      await push(local, a);
      console.log(`Created ${norm(a)} in dashboard; local mirror at ${local}`);
      break;
    }
    case "watch":
      await watchDir();
      break;
    default:
      console.log(`AI Venture paper bridge

Usage:
  tsx --env-file=.env.local scripts/venture-paper.ts list
  tsx --env-file=.env.local scripts/venture-paper.ts new <remotePath>      # create fresh paper in dashboard + local mirror
  tsx --env-file=.env.local scripts/venture-paper.ts pull <remotePath> [localPath]
  tsx --env-file=.env.local scripts/venture-paper.ts push <localPath> [remotePath]
  tsx --env-file=.env.local scripts/venture-paper.ts watch                # auto-sync local mirror -> dashboard
`);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
