import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";
import {
  SYSTEM_DIR,
  basenameOf,
  dirnameOf,
  extensionOf,
  joinProjectPath,
  normalizeName,
  normalizeProjectPath,
} from "./paths";
import { extractTextFromBuffer, isEditableKind, kindForPath, mimeForPath } from "./file-types";
import { LIMITS } from "./types";
import type {
  FileVersion,
  Project,
  ProjectFile,
  Proposal,
  SearchHit,
  TreeNode,
} from "./types";

/**
 * Filesystem-backed project store (access model A: application-stored files).
 *
 * Layout under the workspace root:
 *   <root>/<ownerId>/<projectId>/meta.json        project metadata
 *   <root>/<ownerId>/<projectId>/files/...        user files (posix tree)
 *   <root>/<ownerId>/<projectId>/.workspace/
 *     versions/<path-hash>/<versionId>.json       content snapshots
 *     proposals/<proposalId>.json                 pending/accepted proposals
 *
 * Every method re-validates paths and re-checks the resolved absolute path is
 * inside the project dir, so traversal is blocked even if a caller passes an
 * un-normalized string. Writes are atomic (tmp file + rename). The class takes
 * an explicit root so tests can point it at a temp dir.
 */

export type WorkspaceErrorCode =
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "CONFLICT"
  | "TOO_LARGE"
  | "UNSUPPORTED"
  | "INVALID_PATH"
  | "NOT_EDITABLE"
  | "NOT_EMPTY";

export class WorkspaceError extends Error {
  readonly code: WorkspaceErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: WorkspaceErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "WorkspaceError";
    this.code = code;
    this.details = details;
  }
}

function defaultRoot(): string {
  return (
    process.env.PROJECT_WORKSPACE_DIR ||
    join(process.cwd(), "data", "projects")
  );
}

function hashBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function nowIso(): string {
  return new Date().toISOString();
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

function writeJsonAtomic(path: string, value: unknown): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), "utf-8");
  renameSync(tmp, path);
}

type ProjectMeta = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
};

export class ProjectStore {
  private readonly root: string;

  constructor(root?: string) {
    this.root = resolve(root ?? defaultRoot());
    mkdirSync(this.root, { recursive: true });
  }

  // -- internal path helpers ----------------------------------------------

  private ownerDir(ownerId: string): string {
    if (!ownerId || ownerId.includes("/") || ownerId.includes("\\") || ownerId.includes("..")) {
      throw new WorkspaceError("INVALID_PATH", "Invalid owner");
    }
    return join(this.root, ownerId);
  }

  private projectDir(ownerId: string, projectId: string): string {
    if (!projectId || !/^[A-Za-z0-9_-]{4,64}$/.test(projectId)) {
      throw new WorkspaceError("INVALID_PATH", "Invalid project id");
    }
    return join(this.ownerDir(ownerId), projectId);
  }

  /** Resolve a project-relative path to an absolute path, verifying containment. */
  private absPath(ownerId: string, projectId: string, rel: string): string {
    const normalized = normalizeProjectPath(rel);
    const filesDir = join(this.projectDir(ownerId, projectId), "files");
    const abs = normalized ? join(filesDir, ...normalized.split("/")) : filesDir;
    const resolved = resolve(abs);
    if (resolved !== filesDir && !resolved.startsWith(filesDir + sep)) {
      throw new WorkspaceError("INVALID_PATH", "Path must stay inside the project");
    }
    return resolved;
  }

  private systemDir(ownerId: string, projectId: string): string {
    return join(this.projectDir(ownerId, projectId), SYSTEM_DIR);
  }

  private readMeta(ownerId: string, projectId: string): ProjectMeta {
    const meta = readJson<ProjectMeta>(join(this.projectDir(ownerId, projectId), "meta.json"));
    if (!meta || meta.ownerId !== ownerId) {
      throw new WorkspaceError("NOT_FOUND", "Project not found");
    }
    return meta;
  }

  private touchMeta(ownerId: string, projectId: string): void {
    const dir = this.projectDir(ownerId, projectId);
    const meta = this.readMeta(ownerId, projectId);
    meta.updatedAt = nowIso();
    writeJsonAtomic(join(dir, "meta.json"), meta);
  }

  // -- projects ------------------------------------------------------------

  listProjects(ownerId: string): Project[] {
    const dir = this.ownerDir(ownerId);
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return [];
    }
    const out: Project[] = [];
    for (const entry of entries) {
      const meta = readJson<ProjectMeta>(join(dir, entry, "meta.json"));
      if (!meta || meta.ownerId !== ownerId) continue;
      out.push({ ...meta, fileCount: this.countFiles(ownerId, entry) });
    }
    out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return out;
  }

  createProject(ownerId: string, ownerEmail: string, name: string, description?: string): Project {
    const cleanName = name.trim().slice(0, 120);
    if (!cleanName) throw new WorkspaceError("INVALID_PATH", "Project name is required");
    const id = randomUUID().replace(/-/g, "").slice(0, 16);
    const dir = this.projectDir(ownerId, id);
    mkdirSync(join(dir, "files"), { recursive: true });
    mkdirSync(join(dir, SYSTEM_DIR, "versions"), { recursive: true });
    mkdirSync(join(dir, SYSTEM_DIR, "proposals"), { recursive: true });
    const meta: ProjectMeta = {
      id,
      name: cleanName,
      description: description?.trim().slice(0, 1000) || null,
      ownerId,
      ownerEmail,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    writeJsonAtomic(join(dir, "meta.json"), meta);
    return { ...meta, fileCount: 0 };
  }

  getProject(ownerId: string, projectId: string): Project {
    const meta = this.readMeta(ownerId, projectId);
    return { ...meta, fileCount: this.countFiles(ownerId, projectId) };
  }

  updateProject(
    ownerId: string,
    projectId: string,
    patch: { name?: string; description?: string | null }
  ): Project {
    const dir = this.projectDir(ownerId, projectId);
    const meta = this.readMeta(ownerId, projectId);
    if (patch.name !== undefined) {
      const clean = patch.name.trim().slice(0, 120);
      if (!clean) throw new WorkspaceError("INVALID_PATH", "Project name is required");
      meta.name = clean;
    }
    if (patch.description !== undefined) {
      meta.description = patch.description?.trim().slice(0, 1000) || null;
    }
    meta.updatedAt = nowIso();
    writeJsonAtomic(join(dir, "meta.json"), meta);
    return { ...meta, fileCount: this.countFiles(ownerId, projectId) };
  }

  deleteProject(ownerId: string, projectId: string): void {
    this.readMeta(ownerId, projectId); // existence + ownership check
    rmSync(this.projectDir(ownerId, projectId), { recursive: true, force: true });
  }

  private countFiles(ownerId: string, projectId: string): number {
    try {
      let count = 0;
      const walk = (abs: string) => {
        for (const entry of readdirSync(abs, { withFileTypes: true })) {
          const full = join(abs, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.isFile()) count += 1;
        }
      };
      walk(join(this.projectDir(ownerId, projectId), "files"));
      return count;
    } catch {
      return 0;
    }
  }

  // -- tree ----------------------------------------------------------------

  /**
   * List the project tree. `depth` caps recursion (1 = top level only).
   * System files are never included.
   */
  listTree(ownerId: string, projectId: string, depth = 20): TreeNode[] {
    this.readMeta(ownerId, projectId);
    const filesDir = join(this.projectDir(ownerId, projectId), "files");
    const walk = (abs: string, rel: string, level: number): TreeNode[] => {
      if (level > depth) return [];
      let entries;
      try {
        entries = readdirSync(abs, { withFileTypes: true });
      } catch {
        return [];
      }
      const nodes: TreeNode[] = [];
      for (const entry of entries) {
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        const full = join(abs, entry.name);
        try {
          const st = statSync(full);
          if (entry.isDirectory()) {
            nodes.push({
              name: entry.name,
              path: childRel,
              type: "folder",
              kind: null,
              sizeBytes: 0,
              updatedAt: st.mtime.toISOString(),
              children: walk(full, childRel, level + 1),
            });
          } else if (entry.isFile()) {
            nodes.push({
              name: entry.name,
              path: childRel,
              type: "file",
              kind: kindForPath(childRel),
              sizeBytes: st.size,
              updatedAt: st.mtime.toISOString(),
            });
          }
        } catch {
          // Unreadable entry: skip rather than fail the whole tree.
        }
      }
      nodes.sort((a, b) =>
        a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1
      );
      return nodes;
    };
    return walk(filesDir, "", 1);
  }

  // -- files ---------------------------------------------------------------

  createFolder(ownerId: string, projectId: string, path: string): TreeNode {
    this.readMeta(ownerId, projectId);
    const abs = this.absPath(ownerId, projectId, path);
    try {
      const st = statSync(abs);
      if (st.isDirectory()) {
        throw new WorkspaceError("ALREADY_EXISTS", "A folder already exists at this path");
      }
      throw new WorkspaceError("ALREADY_EXISTS", "A file already exists at this path");
    } catch (err) {
      if (err instanceof WorkspaceError) throw err;
      // ENOENT — create it.
    }
    mkdirSync(abs, { recursive: true });
    this.touchMeta(ownerId, projectId);
    const st = statSync(abs);
    const normalized = normalizeProjectPath(path);
    return {
      name: basenameOf(normalized),
      path: normalized,
      type: "folder",
      kind: null,
      sizeBytes: 0,
      updatedAt: st.mtime.toISOString(),
      children: [],
    };
  }

  async readFile(ownerId: string, projectId: string, path: string): Promise<ProjectFile> {
    this.readMeta(ownerId, projectId);
    const normalized = normalizeProjectPath(path);
    if (!normalized) throw new WorkspaceError("INVALID_PATH", "Path is required");
    const abs = this.absPath(ownerId, projectId, normalized);
    let st;
    try {
      st = statSync(abs);
    } catch {
      throw new WorkspaceError("NOT_FOUND", "File not found");
    }
    if (!st.isFile()) throw new WorkspaceError("NOT_FOUND", "Not a file");

    const kind = kindForPath(normalized);
    const bytes = readFileSync(abs);
    const hash = hashBytes(bytes);
    const editable = isEditableKind(kind) && bytes.length <= LIMITS.maxEditableBytes;

    let content = "";
    let derived = false;
    let truncated = false;
    if (isEditableKind(kind)) {
      content = bytes.toString("utf-8");
      if (bytes.length > LIMITS.maxEditableBytes) {
        content = content.slice(0, LIMITS.maxExtractChars);
        truncated = true;
      }
    } else if (kind === "document") {
      const extracted = await extractTextFromBuffer(normalized, bytes);
      content = extracted.text;
      derived = true;
      truncated = content.length >= LIMITS.maxExtractChars;
    }
    // Images and unknown kinds: content stays "" — the UI offers preview/download
    // and the assistant reports them as unparsed, never as empty.

    return {
      projectId,
      path: normalized,
      name: basenameOf(normalized),
      kind,
      mimeType: mimeForPath(normalized),
      sizeBytes: bytes.length,
      hash,
      updatedAt: st.mtime.toISOString(),
      editable,
      content,
      derived,
      truncated,
    };
  }

  /** Raw bytes for download / image serving. */
  readFileBytes(ownerId: string, projectId: string, path: string): { bytes: Buffer; mimeType: string; name: string } {
    this.readMeta(ownerId, projectId);
    const normalized = normalizeProjectPath(path);
    if (!normalized) throw new WorkspaceError("INVALID_PATH", "Path is required");
    const abs = this.absPath(ownerId, projectId, normalized);
    try {
      const st = statSync(abs);
      if (!st.isFile()) throw new WorkspaceError("NOT_FOUND", "Not a file");
      return { bytes: readFileSync(abs), mimeType: mimeForPath(normalized), name: basenameOf(normalized) };
    } catch (err) {
      if (err instanceof WorkspaceError) throw err;
      throw new WorkspaceError("NOT_FOUND", "File not found");
    }
  }

  /**
   * Create a new text file. Parent folders are created as needed.
   * Only editable kinds can be created with content.
   */
  writeNewFile(
    ownerId: string,
    projectId: string,
    path: string,
    content: string
  ): ProjectFile {
    this.readMeta(ownerId, projectId);
    const normalized = normalizeProjectPath(path);
    if (!normalized) throw new WorkspaceError("INVALID_PATH", "Path is required");
    const kind = kindForPath(normalized);
    if (!isEditableKind(kind)) {
      throw new WorkspaceError("NOT_EDITABLE", `Files ending in .${extensionOf(normalized) || "?"} can't be created as text — upload one instead.`);
    }
    const bytes = Buffer.from(content, "utf-8");
    if (bytes.length > LIMITS.maxEditableBytes) {
      throw new WorkspaceError("TOO_LARGE", "Content exceeds the editable size limit");
    }
    const abs = this.absPath(ownerId, projectId, normalized);
    try {
      statSync(abs);
      throw new WorkspaceError("ALREADY_EXISTS", "A file or folder already exists at this path");
    } catch (err) {
      if (err instanceof WorkspaceError) throw err;
    }
    mkdirSync(join(abs, ".."), { recursive: true });
    this.atomicWrite(abs, bytes);
    this.touchMeta(ownerId, projectId);
    return this.fileInfoSync(projectId, normalized, bytes);
  }

  /**
   * Overwrite an editable file. `expectedHash` is required: when it doesn't
   * match the current content the write is rejected (conflict) so concurrent
   * edits never silently overwrite each other. The previous content is
   * snapshotted first.
   */
  updateFile(
    ownerId: string,
    projectId: string,
    path: string,
    content: string,
    opts: { expectedHash: string; actor: string; source?: FileVersion["source"] }
  ): ProjectFile {
    this.readMeta(ownerId, projectId);
    const normalized = normalizeProjectPath(path);
    if (!normalized) throw new WorkspaceError("INVALID_PATH", "Path is required");
    const kind = kindForPath(normalized);
    if (!isEditableKind(kind)) {
      throw new WorkspaceError("NOT_EDITABLE", "This file type can't be edited as text");
    }
    const bytes = Buffer.from(content, "utf-8");
    if (bytes.length > LIMITS.maxEditableBytes) {
      throw new WorkspaceError("TOO_LARGE", "Content exceeds the editable size limit");
    }
    const abs = this.absPath(ownerId, projectId, normalized);
    let current: Buffer;
    try {
      const st = statSync(abs);
      if (!st.isFile()) throw new WorkspaceError("NOT_FOUND", "Not a file");
      current = readFileSync(abs);
    } catch (err) {
      if (err instanceof WorkspaceError) throw err;
      throw new WorkspaceError("NOT_FOUND", "File not found");
    }
    const currentHash = hashBytes(current);
    if (currentHash !== opts.expectedHash) {
      throw new WorkspaceError("CONFLICT", "This file changed since you opened it — reload and retry.", {
        currentHash,
      });
    }
    this.snapshotVersion(ownerId, projectId, normalized, current, opts.actor, opts.source ?? "user-edit");
    this.atomicWrite(abs, bytes);
    this.touchMeta(ownerId, projectId);
    return this.fileInfoSync(projectId, normalized, bytes);
  }

  /** Store an uploaded file (any kind). Parent folders are created as needed. */
  saveUpload(
    ownerId: string,
    projectId: string,
    path: string,
    bytes: Buffer,
    actor: string
  ): { path: string; sizeBytes: number; hash: string } {
    this.readMeta(ownerId, projectId);
    const normalized = normalizeProjectPath(path);
    if (!normalized) throw new WorkspaceError("INVALID_PATH", "Path is required");
    if (bytes.length > LIMITS.maxUploadBytes) {
      throw new WorkspaceError("TOO_LARGE", "File exceeds the 10MB upload limit");
    }
    const abs = this.absPath(ownerId, projectId, normalized);
    try {
      const st = statSync(abs);
      if (st.isDirectory()) {
        throw new WorkspaceError("ALREADY_EXISTS", "A folder already exists at this path");
      }
      // Overwriting an existing file via upload: snapshot text files first.
      if (isEditableKind(kindForPath(normalized))) {
        this.snapshotVersion(ownerId, projectId, normalized, readFileSync(abs), actor, "upload");
      }
    } catch (err) {
      if (err instanceof WorkspaceError && err.code !== "NOT_FOUND") throw err;
      if (err instanceof WorkspaceError && err.code === "ALREADY_EXISTS") throw err;
      // ENOENT → new file, fine.
    }
    mkdirSync(join(abs, ".."), { recursive: true });
    this.atomicWrite(abs, bytes);
    this.touchMeta(ownerId, projectId);
    return { path: normalized, sizeBytes: bytes.length, hash: hashBytes(bytes) };
  }

  /** Rename or move a file or folder within the project. */
  move(ownerId: string, projectId: string, from: string, toDir: string, newName?: string): { path: string } {
    this.readMeta(ownerId, projectId);
    const src = normalizeProjectPath(from);
    if (!src) throw new WorkspaceError("INVALID_PATH", "Source path is required");
    const destDir = normalizeProjectPath(toDir);
    const name = newName !== undefined ? normalizeName(newName) : basenameOf(src);
    const dest = destDir ? `${destDir}/${name}` : name;
    const normalizedDest = normalizeProjectPath(dest);
    if (normalizedDest.startsWith(src + "/")) {
      throw new WorkspaceError("INVALID_PATH", "Can't move a folder into itself");
    }
    const srcAbs = this.absPath(ownerId, projectId, src);
    try {
      statSync(srcAbs);
    } catch {
      throw new WorkspaceError("NOT_FOUND", "Source not found");
    }
    if (normalizedDest === src) return { path: src };
    const destAbs = this.absPath(ownerId, projectId, normalizedDest);
    try {
      statSync(destAbs);
      throw new WorkspaceError("ALREADY_EXISTS", "Something already exists at the destination");
    } catch (err) {
      if (err instanceof WorkspaceError) throw err;
    }
    mkdirSync(join(destAbs, ".."), { recursive: true });
    renameSync(srcAbs, destAbs);
    this.touchMeta(ownerId, projectId);
    return { path: normalizedDest };
  }

  delete(ownerId: string, projectId: string, path: string): void {
    this.readMeta(ownerId, projectId);
    const normalized = normalizeProjectPath(path);
    if (!normalized) throw new WorkspaceError("INVALID_PATH", "Path is required");
    const abs = this.absPath(ownerId, projectId, normalized);
    try {
      const st = statSync(abs);
      if (st.isDirectory() && readdirSync(abs).length > 0) {
        throw new WorkspaceError("NOT_EMPTY", "Folder is not empty");
      }
      rmSync(abs, { recursive: true, force: true });
    } catch (err) {
      if (err instanceof WorkspaceError) throw err;
      throw new WorkspaceError("NOT_FOUND", "Not found");
    }
    this.touchMeta(ownerId, projectId);
  }

  private atomicWrite(abs: string, bytes: Buffer): void {
    const tmp = `${abs}.${process.pid}.tmp`;
    writeFileSync(tmp, bytes);
    renameSync(tmp, abs);
  }

  private fileInfoSync(projectId: string, path: string, bytes: Buffer): ProjectFile {
    const kind = kindForPath(path);
    return {
      projectId,
      path,
      name: basenameOf(path),
      kind,
      mimeType: mimeForPath(path),
      sizeBytes: bytes.length,
      hash: hashBytes(bytes),
      updatedAt: nowIso(),
      editable: true,
      content: bytes.toString("utf-8"),
      derived: false,
      truncated: false,
    };
  }

  // -- versions ------------------------------------------------------------

  private versionKey(path: string): string {
    return createHash("sha256").update(path).digest("hex").slice(0, 32);
  }

  private snapshotVersion(
    ownerId: string,
    projectId: string,
    path: string,
    bytes: Buffer,
    actor: string,
    source: FileVersion["source"]
  ): void {
    const dir = join(this.systemDir(ownerId, projectId), "versions", this.versionKey(path));
    mkdirSync(dir, { recursive: true });
    const version: FileVersion = {
      id: randomUUID().replace(/-/g, "").slice(0, 12),
      projectId,
      path,
      hash: hashBytes(bytes),
      sizeBytes: bytes.length,
      createdAt: nowIso(),
      createdBy: actor,
      source,
      content: bytes.toString("utf-8"),
    };
    writeJsonAtomic(join(dir, `${version.createdAt.replace(/[:.]/g, "-")}-${version.id}.json`), version);
    // Ring buffer: keep the newest N snapshots.
    const files = readdirSync(dir).sort();
    while (files.length > LIMITS.maxVersionsPerFile) {
      const oldest = files.shift();
      if (!oldest) break;
      try {
        rmSync(join(dir, oldest));
      } catch {
        break;
      }
    }
  }

  listVersions(ownerId: string, projectId: string, path: string): Omit<FileVersion, "content">[] {
    this.readMeta(ownerId, projectId);
    const normalized = normalizeProjectPath(path);
    const dir = join(this.systemDir(ownerId, projectId), "versions", this.versionKey(normalized));
    let files: string[] = [];
    try {
      files = readdirSync(dir).sort().reverse();
    } catch {
      return [];
    }
    const out: Omit<FileVersion, "content">[] = [];
    for (const file of files) {
      const v = readJson<FileVersion>(join(dir, file));
      if (!v) continue;
      out.push({
        id: v.id,
        projectId: v.projectId,
        path: v.path,
        hash: v.hash,
        sizeBytes: v.sizeBytes,
        createdAt: v.createdAt,
        createdBy: v.createdBy,
        source: v.source,
      });
    }
    return out;
  }

  getVersion(ownerId: string, projectId: string, path: string, versionId: string): FileVersion {
    this.readMeta(ownerId, projectId);
    const normalized = normalizeProjectPath(path);
    const dir = join(this.systemDir(ownerId, projectId), "versions", this.versionKey(normalized));
    let files: string[] = [];
    try {
      files = readdirSync(dir);
    } catch {
      throw new WorkspaceError("NOT_FOUND", "Version not found");
    }
    for (const file of files) {
      const v = readJson<FileVersion>(join(dir, file));
      if (v && v.id === versionId) return v;
    }
    throw new WorkspaceError("NOT_FOUND", "Version not found");
  }

  /**
   * Restore a previous version. The current content is snapshotted first, so
   * restore is itself undoable. Requires the caller's expectedHash to match,
   * like any other overwrite.
   */
  restoreVersion(
    ownerId: string,
    projectId: string,
    path: string,
    versionId: string,
    opts: { expectedHash: string; actor: string }
  ): ProjectFile {
    const version = this.getVersion(ownerId, projectId, path, versionId);
    return this.updateFile(ownerId, projectId, path, version.content, {
      expectedHash: opts.expectedHash,
      actor: opts.actor,
      source: "restore",
    });
  }

  // -- search --------------------------------------------------------------

  /**
   * Search filenames and text-file contents. Non-text files match by name
   * only and are reported honestly (no content snippets for unparsed files).
   */
  async search(ownerId: string, projectId: string, query: string): Promise<SearchHit[]> {
    this.readMeta(ownerId, projectId);
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const filesDir = join(this.projectDir(ownerId, projectId), "files");
    const hits: SearchHit[] = [];

    const walk = async (abs: string, rel: string): Promise<void> => {
      if (hits.length >= LIMITS.maxSearchHits) return;
      let entries;
      try {
        entries = readdirSync(abs, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (hits.length >= LIMITS.maxSearchHits) return;
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        const full = join(abs, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.toLowerCase().includes(q)) {
            hits.push({ path: childRel, kind: kindForPath(childRel), line: 0, snippet: `Folder: ${childRel}` });
          }
          await walk(full, childRel);
        } else if (entry.isFile()) {
          const kind = kindForPath(childRel);
          if (entry.name.toLowerCase().includes(q)) {
            hits.push({ path: childRel, kind, line: 0, snippet: `Filename match: ${childRel}` });
          }
          if (!isEditableKind(kind)) continue;
          let st;
          try {
            st = statSync(full);
          } catch {
            continue;
          }
          if (st.size > LIMITS.maxEditableBytes) continue;
          let text: string;
          try {
            text = readFileSync(full, "utf-8");
          } catch {
            continue;
          }
          const lines = text.split("\n");
          for (let i = 0; i < lines.length && hits.length < LIMITS.maxSearchHits; i++) {
            const line = lines[i] ?? "";
            const idx = line.toLowerCase().indexOf(q);
            if (idx === -1) continue;
            const start = Math.max(0, idx - 60);
            const snippet = (start > 0 ? "…" : "") + line.slice(start, idx + q.length + 80).trim() + (idx + q.length + 80 < line.length ? "…" : "");
            hits.push({ path: childRel, kind, line: i + 1, snippet });
            if (hits.filter((h) => h.path === childRel).length >= 5) break;
          }
        }
      }
    };
    await walk(filesDir, "");
    return hits;
  }

  // -- proposals -----------------------------------------------------------

  private proposalsDir(ownerId: string, projectId: string): string {
    const dir = join(this.systemDir(ownerId, projectId), "proposals");
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  createProposal(
    ownerId: string,
    projectId: string,
    input: { op: "create" | "edit"; path: string; summary: string; content: string; createdBy: "assistant" | "user" }
  ): Proposal {
    this.readMeta(ownerId, projectId);
    const normalized = normalizeProjectPath(input.path);
    if (!normalized) throw new WorkspaceError("INVALID_PATH", "Path is required");
    const summary = input.summary.trim().slice(0, 500);
    if (!summary) throw new WorkspaceError("INVALID_PATH", "A summary is required");
    if (!isEditableKind(kindForPath(normalized))) {
      throw new WorkspaceError("NOT_EDITABLE", "This file type can't be edited as text");
    }
    if (Buffer.byteLength(input.content, "utf-8") > LIMITS.maxEditableBytes) {
      throw new WorkspaceError("TOO_LARGE", "Proposed content exceeds the editable size limit");
    }

    let baseHash: string | null = null;
    const abs = this.absPath(ownerId, projectId, normalized);
    let exists = false;
    try {
      exists = statSync(abs).isFile();
    } catch {
      exists = false;
    }
    if (input.op === "edit") {
      if (!exists) throw new WorkspaceError("NOT_FOUND", "File to edit was not found");
      baseHash = hashBytes(readFileSync(abs));
    } else if (exists) {
      throw new WorkspaceError("ALREADY_EXISTS", "A file already exists at this path");
    }

    const proposal: Proposal = {
      id: randomUUID().replace(/-/g, "").slice(0, 12),
      projectId,
      op: input.op,
      path: normalized,
      summary,
      content: input.content,
      baseHash,
      status: "pending",
      createdAt: nowIso(),
      createdBy: input.createdBy,
      decidedAt: null,
    };
    writeJsonAtomic(join(this.proposalsDir(ownerId, projectId), `${proposal.id}.json`), proposal);
    return proposal;
  }

  listProposals(ownerId: string, projectId: string, status?: Proposal["status"]): Proposal[] {
    this.readMeta(ownerId, projectId);
    let files: string[] = [];
    try {
      files = readdirSync(this.proposalsDir(ownerId, projectId));
    } catch {
      return [];
    }
    const out: Proposal[] = [];
    for (const file of files) {
      const p = readJson<Proposal>(join(this.proposalsDir(ownerId, projectId), file));
      if (!p) continue;
      if (status && p.status !== status) continue;
      // Lazily mark edits whose base changed as stale.
      if (p.status === "pending" && p.op === "edit" && p.baseHash) {
        try {
          const current = hashBytes(readFileSync(this.absPath(ownerId, projectId, p.path)));
          if (current !== p.baseHash) p.status = "stale";
        } catch {
          p.status = "stale";
        }
      }
      out.push(p);
    }
    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return out;
  }

  getProposal(ownerId: string, projectId: string, proposalId: string): Proposal {
    this.readMeta(ownerId, projectId);
    const p = readJson<Proposal>(join(this.proposalsDir(ownerId, projectId), `${proposalId}.json`));
    if (!p) throw new WorkspaceError("NOT_FOUND", "Proposal not found");
    return p;
  }

  private saveProposal(ownerId: string, projectId: string, proposal: Proposal): void {
    writeJsonAtomic(
      join(this.proposalsDir(ownerId, projectId), `${proposal.id}.json`),
      proposal
    );
  }

  rejectProposal(ownerId: string, projectId: string, proposalId: string): Proposal {
    const p = this.getProposal(ownerId, projectId, proposalId);
    if (p.status !== "pending" && p.status !== "stale") {
      throw new WorkspaceError("CONFLICT", "Proposal was already decided");
    }
    p.status = "rejected";
    p.decidedAt = nowIso();
    this.saveProposal(ownerId, projectId, p);
    return p;
  }

  /**
   * Accept a proposal: applies the change (snapshotting the previous content
   * first) and marks the proposal accepted. Edit proposals whose base changed
   * are rejected as conflicts instead of overwriting.
   */
  acceptProposal(ownerId: string, projectId: string, proposalId: string, actor: string): { proposal: Proposal; file: ProjectFile } {
    const p = this.getProposal(ownerId, projectId, proposalId);
    if (p.status === "accepted" || p.status === "rejected") {
      throw new WorkspaceError("CONFLICT", "Proposal was already decided");
    }
    if (p.op === "create") {
      const file = this.writeNewFile(ownerId, projectId, p.path, p.content);
      p.status = "accepted";
      p.decidedAt = nowIso();
      this.saveProposal(ownerId, projectId, p);
      return { proposal: p, file };
    }
    // Edit: verify the base is still current, then apply.
    const abs = this.absPath(ownerId, projectId, p.path);
    let current: Buffer;
    try {
      current = readFileSync(abs);
    } catch {
      p.status = "stale";
      this.saveProposal(ownerId, projectId, p);
      throw new WorkspaceError("CONFLICT", "The file was deleted or moved — the proposal is stale.");
    }
    if (p.baseHash && hashBytes(current) !== p.baseHash) {
      p.status = "stale";
      this.saveProposal(ownerId, projectId, p);
      throw new WorkspaceError(
        "CONFLICT",
        "The file changed since this proposal was made — review the current file and ask for a fresh proposal."
      );
    }
    const file = this.updateFile(ownerId, projectId, p.path, p.content, {
      expectedHash: p.baseHash ?? hashBytes(current),
      actor,
      source: "assistant-accepted",
    });
    p.status = "accepted";
    p.decidedAt = nowIso();
    this.saveProposal(ownerId, projectId, p);
    return { proposal: p, file };
  }

  // -- context assembly ----------------------------------------------------

  /**
   * Read several text files as one bounded context bundle for the assistant.
   * Non-text files are reported as unparsed references, never as empty text.
   */
  async readContextBundle(
    ownerId: string,
    projectId: string,
    paths: string[],
    budgetChars = LIMITS.maxContextChars
  ): Promise<{ included: { path: string; content: string; truncated: boolean }[]; skipped: { path: string; reason: string }[] }> {
    this.readMeta(ownerId, projectId);
    const included: { path: string; content: string; truncated: boolean }[] = [];
    const skipped: { path: string; reason: string }[] = [];
    let used = 0;
    for (const raw of paths.slice(0, 25)) {
      let normalized: string;
      try {
        normalized = normalizeProjectPath(raw);
      } catch {
        skipped.push({ path: raw, reason: "invalid path" });
        continue;
      }
      if (!normalized) continue;
      const kind = kindForPath(normalized);
      const abs = this.absPath(ownerId, projectId, normalized);
      let bytes: Buffer;
      try {
        const st = statSync(abs);
        if (!st.isFile()) {
          skipped.push({ path: normalized, reason: "not a file" });
          continue;
        }
        bytes = readFileSync(abs);
      } catch {
        skipped.push({ path: normalized, reason: "not found" });
        continue;
      }
      if (!isEditableKind(kind) && kind !== "document") {
        skipped.push({
          path: normalized,
          reason: kind === "image" ? "image — contents not sent to the AI" : "unsupported type — contents not sent to the AI",
        });
        continue;
      }
      const { text, derived } = kind === "document"
        ? await extractTextFromBuffer(normalized, bytes)
        : { text: bytes.toString("utf-8"), derived: false };
      if (kind === "document" && !text) {
        skipped.push({ path: normalized, reason: "no extractable text" });
        continue;
      }
      const remaining = budgetChars - used;
      if (remaining <= 500) {
        skipped.push({ path: normalized, reason: "context budget reached" });
        continue;
      }
      const slice = text.slice(0, remaining);
      used += slice.length;
      included.push({
        path: normalized + (derived ? " (extracted text)" : ""),
        content: slice,
        truncated: slice.length < text.length,
      });
    }
    return { included, skipped };
  }
}

/** Join helper re-exported for routes that build upload destinations. */
export { joinProjectPath, normalizeName, normalizeProjectPath };
export { extensionOf, basenameOf, dirnameOf };
