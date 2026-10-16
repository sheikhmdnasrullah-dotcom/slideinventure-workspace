import posixPath from "node:path/posix";

/**
 * Path handling for project files. Every file operation funnels through
 * `normalizeProjectPath`, which guarantees the result stays inside the project
 * root (no `..` escapes, no absolute paths, no backslash tricks, no hidden
 * `.workspace` system dir access).
 */

export const SYSTEM_DIR = ".workspace";

const MAX_SEGMENTS = 32;
const MAX_PATH_CHARS = 512;
const MAX_NAME_CHARS = 120;

export class InvalidPathError extends Error {
  readonly code = "INVALID_PATH";
  constructor(message: string) {
    super(message);
    this.name = "InvalidPathError";
  }
}

function fail(reason: string): never {
  throw new InvalidPathError(reason);
}

/**
 * Normalize a user- or AI-supplied path to a project-relative posix path.
 * Returns "" for the project root. Throws InvalidPathError on anything that
 * would escape the root or touch the system dir.
 */
export function normalizeProjectPath(input: string): string {
  if (typeof input !== "string") fail("Path must be a string");
  const trimmed = input.trim().replace(/\\/g, "/");
  if (trimmed === "" || trimmed === "/" || trimmed === ".") return "";
  if (trimmed.length > MAX_PATH_CHARS) fail("Path is too long");

  // Collapse `.` and reject `..` lexically before posix.normalize can hide it.
  const rawSegments = trimmed.split("/").filter((s) => s.length > 0 && s !== ".");
  for (const seg of rawSegments) {
    if (seg === "..") fail("Path must stay inside the project");
    if (seg.length > MAX_NAME_CHARS) fail(`Name is too long: ${seg.slice(0, 40)}…`);
    // Control chars and path separators smuggled in via unicode are rejected.
    if (/[\u0000-\u001f\u007f]/.test(seg)) fail("Path contains invalid characters");
  }
  if (rawSegments.length > MAX_SEGMENTS) fail("Path is too deep");

  const normalized = posixPath.normalize(rawSegments.join("/"));
  if (normalized === "." || normalized === "") return "";
  if (normalized.startsWith("..") || posixPath.isAbsolute(normalized)) {
    fail("Path must stay inside the project");
  }
  if (normalized.split("/").includes(SYSTEM_DIR)) fail("Reserved folder");

  return normalized;
}

/** Validate a single file/folder name (no separators). */
export function normalizeName(input: string): string {
  if (typeof input !== "string") fail("Name must be a string");
  const name = input.trim();
  if (!name || name === "." || name === "..") fail("Name is required");
  if (name.length > MAX_NAME_CHARS) fail("Name is too long");
  if (name.includes("/") || name.includes("\\")) fail("Name cannot contain a path separator");
  if (/[\u0000-\u001f\u007f]/.test(name)) fail("Name contains invalid characters");
  if (name === SYSTEM_DIR) fail("Reserved name");
  return name;
}

export function joinProjectPath(dir: string, name: string): string {
  const d = normalizeProjectPath(dir);
  const n = normalizeName(name);
  return normalizeProjectPath(d ? `${d}/${n}` : n);
}

export function dirnameOf(path: string): string {
  const p = normalizeProjectPath(path);
  if (!p) return "";
  const dir = posixPath.dirname(p);
  return dir === "." ? "" : dir;
}

export function basenameOf(path: string): string {
  const p = normalizeProjectPath(path);
  if (!p) return "";
  return posixPath.basename(p);
}

export function extensionOf(path: string): string {
  const base = basenameOf(path);
  const idx = base.lastIndexOf(".");
  if (idx <= 0) return "";
  return base.slice(idx + 1).toLowerCase();
}
