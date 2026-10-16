import { extensionOf } from "./paths";
import type { FileKind } from "./types";
import { LIMITS } from "./types";

/**
 * File-type handling. Only extensions whose meaning is verified below get
 * special treatment; everything else is `unknown` (kept, downloadable, never
 * misrepresented as parsed).
 */

const KIND_BY_EXT: Record<string, FileKind> = {
  md: "markdown",
  markdown: "markdown",
  txt: "text",
  text: "text",
  log: "text",
  sql: "sql",
  json: "data",
  yaml: "data",
  yml: "data",
  csv: "data",
  tsv: "data",
  pdf: "document",
  docx: "document",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
};

const MIME_BY_EXT: Record<string, string> = {
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
  text: "text/plain",
  log: "text/plain",
  sql: "application/sql",
  json: "application/json",
  yaml: "application/yaml",
  yml: "application/yaml",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export function kindForPath(path: string): FileKind {
  return KIND_BY_EXT[extensionOf(path)] ?? "unknown";
}

export function mimeForPath(path: string): string {
  return MIME_BY_EXT[extensionOf(path)] ?? "application/octet-stream";
}

export function isEditableKind(kind: FileKind): boolean {
  return kind === "markdown" || kind === "text" || kind === "sql" || kind === "data";
}

/** Kinds whose bytes are UTF-8 text and can be searched / sent as context. */
export function isTextKind(kind: FileKind): boolean {
  return isEditableKind(kind);
}

/**
 * Extract readable text from stored bytes. Used for previews, search, and AI
 * context. Returns "" for images/unknown types — callers must surface those as
 * "not parsed", never as empty files.
 */
export async function extractTextFromBuffer(
  filename: string,
  buffer: Buffer
): Promise<{ text: string; derived: boolean }> {
  const kind = kindForPath(filename);
  const cap = LIMITS.maxExtractChars;

  if (isTextKind(kind)) {
    return { text: buffer.toString("utf-8").slice(0, cap), derived: false };
  }

  if (extensionOf(filename) === "pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const parsed = await parser.getText();
      return { text: (parsed.text || "").slice(0, cap), derived: true };
    } catch (err) {
      console.error("Project workspace PDF extraction failed:", err);
      return { text: "", derived: true };
    }
  }

  if (extensionOf(filename) === "docx") {
    try {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer });
      return { text: (value || "").slice(0, cap), derived: true };
    } catch (err) {
      console.error("Project workspace DOCX extraction failed:", err);
      return { text: "", derived: true };
    }
  }

  return { text: "", derived: true };
}
