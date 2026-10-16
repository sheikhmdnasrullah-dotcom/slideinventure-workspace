/**
 * Project Workspace — shared types.
 *
 * A Project is a user-owned folder of working files stored by the application
 * (access model A: server-side storage, see README.md). Files are addressed by
 * a stable project id plus a normalized posix path inside the project.
 */

export type Project = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
};

export type FileKind =
  | "markdown"
  | "text"
  | "sql"
  | "data" // json / yaml / csv / tsv — structured text, editable
  | "document" // pdf / docx — extracted-text preview, read-only
  | "image" // png / jpg / gif / webp / svg — preview, read-only
  | "unknown";

export type TreeNode = {
  name: string;
  path: string; // posix path relative to project root, "" for root
  type: "file" | "folder";
  kind: FileKind | null; // files only
  sizeBytes: number;
  updatedAt: string;
  children?: TreeNode[]; // folders only, when tree is expanded
};

export type ProjectFile = {
  projectId: string;
  path: string;
  name: string;
  kind: FileKind;
  mimeType: string;
  sizeBytes: number;
  /** sha256 of the stored bytes — concurrency token for saves and proposals. */
  hash: string;
  updatedAt: string;
  editable: boolean;
  /** Full text for editable files; extracted text for documents; "" otherwise. */
  content: string;
  /** True when content is derived (extraction) rather than the stored bytes. */
  derived: boolean;
  truncated: boolean;
};

export type FileVersion = {
  id: string;
  projectId: string;
  path: string;
  hash: string;
  sizeBytes: number;
  createdAt: string;
  createdBy: string;
  source: "user-edit" | "assistant-accepted" | "restore" | "upload";
  content: string;
};

export type ProposalStatus = "pending" | "accepted" | "rejected" | "stale";

export type Proposal = {
  id: string;
  projectId: string;
  /** "create" targets a path that must not exist yet; "edit" must exist. */
  op: "create" | "edit";
  path: string;
  /** Human-readable summary of the intended change (shown before the diff). */
  summary: string;
  /** Full proposed content. */
  content: string;
  /** Hash of the file when the proposal was made (edits only). */
  baseHash: string | null;
  status: ProposalStatus;
  createdAt: string;
  createdBy: "assistant" | "user";
  decidedAt: string | null;
};

export type SearchHit = {
  path: string;
  kind: FileKind;
  /** 1-based line number of the match, or 0 for filename matches. */
  line: number;
  snippet: string;
};

export type SourceRef = {
  path: string;
  line?: number;
  excerpt?: string;
};

/** Limits are enforced server-side in the store, never only in the UI. */
export const LIMITS = {
  /** Editable text files larger than this are served read-only + truncated. */
  maxEditableBytes: 512 * 1024,
  /** Uploads larger than this are rejected. */
  maxUploadBytes: 10 * 1024 * 1024,
  /** Text extraction (pdf/docx) is capped at this many characters. */
  maxExtractChars: 200_000,
  /** Versions kept per file (ring buffer). */
  maxVersionsPerFile: 20,
  /** Search result cap per query. */
  maxSearchHits: 50,
  /** Characters of project context assembled for one assistant turn. */
  maxContextChars: 60_000,
} as const;
