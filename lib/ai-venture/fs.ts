import fs from "fs";
import path from "path";

export const AI_VENTURE_DIR = path.join(process.cwd(), "AI Venture");

const IGNORED = new Set([".DS_Store", "Thumbs.db"]);
const TEXT_EXTENSIONS = new Set([".md", ".txt"]);

export type VentureNode = {
  path: string; // relative to AI_VENTURE_DIR, "/" separated
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

// Resolves a relative path against AI_VENTURE_DIR and refuses anything that
// escapes it (symlink, "..", absolute path injection) — this is the only
// gate between the browser and the real filesystem, so it must be strict.
export function resolveSafePath(relativePath: string): string {
  const normalized = (relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const resolved = path.resolve(AI_VENTURE_DIR, normalized);
  const base = AI_VENTURE_DIR + path.sep;
  if (resolved !== AI_VENTURE_DIR && !resolved.startsWith(base)) {
    throw new VentureFsError("Path escapes AI Venture directory", 400);
  }
  if (fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink()) {
    throw new VentureFsError("Symlinks are not allowed", 400);
  }
  return resolved;
}

function toRelative(absolutePath: string): string {
  return path.relative(AI_VENTURE_DIR, absolutePath).replace(/\\/g, "/");
}

export function isTextFile(name: string): boolean {
  return TEXT_EXTENSIONS.has(path.extname(name).toLowerCase());
}

function buildNode(absolutePath: string, name: string): VentureNode | null {
  if (IGNORED.has(name) || name.startsWith(".")) return null;
  const stat = fs.lstatSync(absolutePath);
  if (stat.isSymbolicLink()) return null;

  const relative = toRelative(absolutePath);

  if (stat.isDirectory()) {
    const children = fs
      .readdirSync(absolutePath)
      .map((child) => buildNode(path.join(absolutePath, child), child))
      .filter((n): n is VentureNode => n !== null)
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1));

    return {
      path: relative,
      name,
      type: "folder",
      ext: null,
      size: 0,
      modifiedAt: stat.mtime.toISOString(),
      children,
    };
  }

  return {
    path: relative,
    name,
    type: "file",
    ext: path.extname(name).toLowerCase() || null,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
  };
}

// Metadata-only recursive tree — never reads file contents.
export function listTree(): VentureNode {
  if (!fs.existsSync(AI_VENTURE_DIR)) {
    fs.mkdirSync(AI_VENTURE_DIR, { recursive: true });
  }
  const stat = fs.statSync(AI_VENTURE_DIR);
  const children = fs
    .readdirSync(AI_VENTURE_DIR)
    .map((child) => buildNode(path.join(AI_VENTURE_DIR, child), child))
    .filter((n): n is VentureNode => n !== null)
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1));

  return {
    path: "",
    name: "AI Venture",
    type: "folder",
    ext: null,
    size: 0,
    modifiedAt: stat.mtime.toISOString(),
    children,
  };
}

export function readFileContent(relativePath: string): { content: string; name: string; size: number; modifiedAt: string } {
  const abs = resolveSafePath(relativePath);
  if (!fs.existsSync(abs)) throw new VentureFsError("File not found", 404);
  const stat = fs.lstatSync(abs);
  if (!stat.isFile()) throw new VentureFsError("Not a file", 400);
  if (!isTextFile(abs)) throw new VentureFsError("Unsupported file type", 415);

  return {
    content: fs.readFileSync(abs, "utf-8"),
    name: path.basename(abs),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
  };
}

export function writeFileContent(relativePath: string, content: string): void {
  const abs = resolveSafePath(relativePath);
  if (!isTextFile(abs)) throw new VentureFsError("Only .md and .txt files can be edited", 415);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
}

export function createEntry(relativePath: string, type: "file" | "folder"): void {
  const abs = resolveSafePath(relativePath);
  if (fs.existsSync(abs)) throw new VentureFsError("Already exists", 409);

  if (type === "folder") {
    fs.mkdirSync(abs, { recursive: true });
    return;
  }
  if (!isTextFile(abs)) throw new VentureFsError("Only .md and .txt files can be created", 415);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, "", "utf-8");
}

export function moveEntry(fromRelative: string, toRelative: string): void {
  const from = resolveSafePath(fromRelative);
  const to = resolveSafePath(toRelative);
  if (!fs.existsSync(from)) throw new VentureFsError("Source not found", 404);
  if (fs.existsSync(to)) throw new VentureFsError("Destination already exists", 409);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
}

export function deleteEntry(relativePath: string): void {
  const abs = resolveSafePath(relativePath);
  if (abs === AI_VENTURE_DIR) throw new VentureFsError("Cannot delete the root folder", 400);
  if (!fs.existsSync(abs)) throw new VentureFsError("Not found", 404);
  fs.rmSync(abs, { recursive: true, force: true });
}
