/**
 * Content Classifier — rule-based first, NVIDIA LLM later.
 *
 * Takes a raw artifact (file, text, metadata) and returns a classified
 * content object with `content_type` + extracted structure. No LLM codegen;
 * the classifier only emits the enum + extracted fields, which the registry
 * validates via Zod before persisting.
 */

import { ContentType, validateContent } from "./registry";

/**
 * Input artifact from an upload, agent output, import, or research.
 */
export type ArtifactInput =
  | { kind: "text"; text: string; filename?: string; mime_type?: string; metadata?: Record<string, unknown> }
  | { kind: "file"; buffer: Buffer; filename: string; mime_type: string; metadata?: Record<string, unknown> }
  | { kind: "research"; findings: string; sources: string[]; entities?: string[]; metadata?: Record<string, unknown> }
  | { kind: "agent_execution"; agent_type: string; output: string; task_id?: string; progress?: { current: number; total: number; current_item?: string }; metadata?: Record<string, unknown> }
  | { kind: "web_research"; queries: string[]; findings: string; sources: Array<{ url: string; title: string; snippet: string }>; metadata?: Record<string, unknown> }
  | { kind: "structured"; data: Record<string, unknown>; mime_type: string; filename?: string; metadata?: Record<string, unknown> };

/**
 * Result of classification.
 */
export type ClassificationResult =
  | { success: true; content: ReturnType<typeof validateContent>["data"] }
  | { success: false; error: string; fallback: ReturnType<typeof validateContent>["fallback"] };

/**
 * Detect content type from filename + mime type (rule-based, no LLM).
 */
function detectByMimeAndFilename(filename: string, mimeType: string): ContentType {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (ext === "csv" || mimeType === "text/csv") return "CSV";
  if (ext === "pdf" || mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (ext === "md" || ext === "txt" || mimeType === "text/plain" || mimeType === "text/markdown") return "TEXT";
  if (ext === "json" || mimeType === "application/json") return "DOCUMENT";
  if (ext === "xlsx" || ext === "xls" || mimeType.includes("spreadsheet")) return "SPREADSHEET";

  return "UNKNOWN";
}

/**
 * Heuristic content analysis for text-based artifacts.
 */
function analyzeTextContent(text: string, hintType?: ContentType): { type: ContentType; extracted: Record<string, unknown> } {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  const hasCitations = /\[\d+\]|\(https?:\/\//.test(text);
  const hasFindings = /findings?|conclusion|evidence|source:/i.test(text);
  const hasSteps = /^(\d+\.|-\s|step\s*\d)/im.test(text);
  const hasDecision = /decision|resolved|agreed|chosen|we will/i.test(text);
  const looksLikeCSV = lines.length > 2 && lines[0].includes(",") && lines.every((l) => l.split(",").length === lines[0].split(",").length);
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text);
  const hasCompany = /company|organization|firm|startup/i.test(text);

  if (hintType && hintType !== "TEXT" && hintType !== "DOCUMENT" && hintType !== "UNKNOWN") {
    return { type: hintType, extracted: {} };
  }

  if (hasCitations && hasFindings && lines.length > 10) {
    return { type: "RESEARCH", extracted: {} };
  }
  if (hasSteps && /procedure|process|standard|operating/i.test(text)) {
    return { type: "SOP", extracted: {} };
  }
  if (hasDecision && lines.length < 50) {
    return { type: "DECISION", extracted: {} };
  }
  if (looksLikeCSV) {
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((l) => l.split(",").map((c) => c.trim()));
    return { type: "CSV", extracted: { headers, rows, row_count: rows.length } };
  }
  if (hasEmail && hasCompany && lines.length < 30) {
    return { type: "LEAD", extracted: {} };
  }
  return { type: "DOCUMENT", extracted: {} };
}

/**
 * Classify a text artifact.
 */
export async function classifyTextArtifact(
  text: string,
  filename?: string,
  metadata?: Record<string, unknown>
): Promise<ClassificationResult> {
  const { type, extracted } = analyzeTextContent(text);
  const title = filename?.replace(/\.[^.]+$/, "") || "Untitled";

  const base = {
    content_type: type,
    title,
    source: metadata?.source as string | undefined,
    author: metadata?.author as string | undefined,
    tags: (metadata?.tags as string[]) ?? [],
    metadata: { ...metadata, ...extracted },
  };

  // Build content object based on type
  let content: Record<string, unknown> = { ...base };

  switch (type) {
    case "RESEARCH":
      content = { ...base, body: text, findings: [], entities: [] };
      break;
    case "SOP":
      content = { ...base, body: text, version: "1.0" };
      break;
    case "DECISION":
      content = { ...base, body: text, status: "proposed", related: [] };
      break;
    case "CSV":
      content = { ...base, headers: extracted.headers, rows: extracted.rows, row_count: extracted.row_count, delimiter: "," };
      break;
    case "LEAD":
      content = { ...base, email: text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] };
      break;
    case "INSIGHT":
      content = { ...base, body: text, evidence_refs: [], confidence: 0.8 };
      break;
    case "SOURCE":
      content = { ...base, body: text };
      break;
    case "AGENT_EXECUTION":
      content = { ...base, body: text, agent_type: "unknown", task_id: undefined, status: "completed" };
      break;
    case "WEB_RESEARCH":
      content = { ...base, body: text, queries: [], sources: [] };
      break;
    case "CLAUDE_SESSION":
      content = { ...base, body: text, session_id: undefined, project: undefined };
      break;
    case "CLIENT":
      content = { ...base, name: title, email: undefined, company: undefined, status: "active" };
      break;
    default:
      content = { ...base, body: text };
  }

  const validation = validateContent(content);
  if (validation.success) return { success: true, content: validation.data! };
  return { success: false, error: validation.error!, fallback: validation.fallback! };
}

/**
 * Classify a file artifact (PDF, image, spreadsheet, etc.).
 */
export async function classifyFileArtifact(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  metadata?: Record<string, unknown>
): Promise<ClassificationResult> {
  const hintType = detectByMimeAndFilename(filename, mimeType);

  if (hintType === "PDF") {
    return classifyPDF(buffer, filename, metadata);
  }
  if (hintType === "IMAGE") {
    return classifyImage(buffer, filename, metadata);
  }
  if (hintType === "SPREADSHEET") {
    return classifySpreadsheet(buffer, filename, metadata);
  }
  if (hintType === "CSV") {
    return classifyCSV(buffer, filename, metadata);
  }

  // Fallback: try to read as text
  try {
    const text = buffer.toString("utf-8");
    return classifyTextArtifact(text, filename, metadata);
  } catch {
    return {
      success: false,
      error: "Unable to decode file as text",
      fallback: {
        content_type: "UNKNOWN",
        title: filename,
        tags: [],
        metadata: metadata ?? {},
        raw: { filename, mimeType, size: buffer.length },
      },
    };
  }
}

/**
 * Classify PDF — extract text + metadata using pdf-parse.
 */
async function classifyPDF(buffer: Buffer, filename: string, metadata?: Record<string, unknown>): Promise<ClassificationResult> {
  try {
    const pdfParse = (await import("pdf-parse")) as unknown as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
    const data = await pdfParse(buffer);
    const text = data.text || "";
    const pageCount = data.numpages || 0;

    analyzeTextContent(text, "PDF");

    const content = {
      content_type: "PDF",
      title: filename.replace(/\.pdf$/i, ""),
      source: metadata?.source as string | undefined,
      author: metadata?.author as string | undefined,
      tags: (metadata?.tags as string[]) ?? [],
      metadata: { ...metadata, page_count: pageCount, extracted_text_length: text.length },
      body: text.substring(0, 10000),
      page_count: pageCount,
      extracted_text: text.length > 10000 ? text.substring(0, 10000) + "…" : text,
    };

    const validation = validateContent(content);
    if (validation.success) return { success: true, content: validation.data! };
    return { success: false, error: validation.error!, fallback: validation.fallback! };
  } catch (error) {
    return {
      success: false,
      error: `PDF parsing failed: ${error}`,
      fallback: {
        content_type: "PDF",
        title: filename.replace(/\.pdf$/i, ""),
        tags: [],
        metadata: { ...metadata, error: String(error) },
        page_count: 0,
      },
    };
  }
}

/**
 * Classify image — metadata only (OCR later).
 */
async function classifyImage(buffer: Buffer, filename: string, metadata?: Record<string, unknown>): Promise<ClassificationResult> {
  const content = {
    content_type: "IMAGE",
    title: filename.replace(/\.[^.]+$/, ""),
    source: metadata?.source as string | undefined,
    author: metadata?.author as string | undefined,
    tags: (metadata?.tags as string[]) ?? [],
    metadata: { ...metadata, file_size: buffer.length },
    file_size: buffer.length,
  };

  const validation = validateContent(content);
  return validation.success
    ? { success: true, content: validation.data! }
    : { success: false, error: validation.error!, fallback: validation.fallback! };
}

/**
 * Classify spreadsheet — not implemented (no xlsx dep due to vulns).
 */
async function classifySpreadsheet(buffer: Buffer, filename: string, metadata?: Record<string, unknown>): Promise<ClassificationResult> {
  return {
    success: false,
    error: "Spreadsheet parsing requires 'xlsx' package (not installed due to security advisories). Use CSV instead.",
    fallback: {
      content_type: "UNKNOWN",
      title: filename,
      tags: [],
      metadata: { ...metadata, error: "xlsx not installed", original_type: "spreadsheet" },
      raw: { filename, size: buffer.length },
    },
  };
}

/**
 * Classify CSV — parse headers + rows.
 */
async function classifyCSV(buffer: Buffer, filename: string, metadata?: Record<string, unknown>): Promise<ClassificationResult> {
  try {
    const text = buffer.toString("utf-8");
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    const delimiter = text.includes("\t") ? "\t" : ",";
    const headers = lines[0]?.split(delimiter).map((h) => h.trim()) || [];
    const rows = lines.slice(1).map((l) => l.split(delimiter).map((c) => c.trim()));

    const content = {
      content_type: "CSV",
      title: filename.replace(/\.csv$/i, ""),
      source: metadata?.source as string | undefined,
      author: metadata?.author as string | undefined,
      tags: (metadata?.tags as string[]) ?? [],
      metadata: { ...metadata, row_count: rows.length, delimiter },
      headers,
      rows,
      row_count: rows.length,
    };

    const validation = validateContent(content);
    return validation.success
      ? { success: true, content: validation.data! }
      : { success: false, error: validation.error!, fallback: validation.fallback! };
  } catch (error) {
    return {
      success: false,
      error: `CSV parsing failed: ${error}`,
      fallback: {
        content_type: "UNKNOWN",
        title: filename,
        tags: [],
        metadata: { ...metadata, error: String(error) },
        raw: { error: String(error), filename },
      },
    };
  }
}

/**
 * Classify agent execution output.
 */
export function classifyAgentExecution(
  agentType: string,
  output: string,
  taskId?: string,
  progress?: { current: number; total: number; current_item?: string },
  metadata?: Record<string, unknown>
): ClassificationResult {
  const content = {
    content_type: "AGENT_EXECUTION",
    title: `${agentType} execution${taskId ? ` — ${taskId}` : ""}`,
    source: "agent",
    author: "system",
    tags: ["agent", agentType],
    metadata: { ...metadata, agent_type: agentType, task_id: taskId },
    body: output,
    agent_type: agentType,
    task_id: taskId,
    status: progress ? (progress.current >= progress.total ? "completed" : "running") : "completed",
    progress,
  };

  const validation = validateContent(content);
  return validation.success
    ? { success: true, content: validation.data! }
    : { success: false, error: validation.error!, fallback: validation.fallback! };
}

/**
 * Classify web research output.
 */
export function classifyWebResearch(
  queries: string[],
  findings: string,
  sources: Array<{ url: string; title: string; snippet: string }>,
  metadata?: Record<string, unknown>
): ClassificationResult {
  const content = {
    content_type: "WEB_RESEARCH",
    title: `Web research: ${queries.slice(0, 3).join(", ")}`,
    source: "web",
    author: "system",
    tags: ["research", "web"],
    metadata: { ...metadata, queries },
    body: findings,
    queries,
    sources,
  };

  const validation = validateContent(content);
  return validation.success
    ? { success: true, content: validation.data! }
    : { success: false, error: validation.error!, fallback: validation.fallback! };
}

/**
 * Main classify entry point — routes by artifact kind.
 */
export async function classifyArtifact(input: ArtifactInput): Promise<ClassificationResult> {
  switch (input.kind) {
    case "text":
      return classifyTextArtifact(input.text, input.filename, input.metadata);
    case "file":
      return classifyFileArtifact(input.buffer, input.filename, input.mime_type, input.metadata);
    case "research":
      return classifyTextArtifact(input.findings, undefined, {
        ...input.metadata,
        source: "research",
        sources: input.sources,
      });
    case "agent_execution":
      return classifyAgentExecution(
        input.agent_type,
        input.output,
        input.task_id,
        input.progress,
        input.metadata
      );
    case "web_research":
      return classifyWebResearch(
        input.queries,
        input.findings,
        input.sources,
        input.metadata
      );
    case "structured":
      return classifyTextArtifact(JSON.stringify(input.data, null, 2), input.filename, {
        ...input.metadata,
        source: "structured",
      });
    default:
      return {
        success: false,
        error: "Unknown artifact kind",
        fallback: {
          content_type: "UNKNOWN",
          title: "Unknown",
          tags: [],
          metadata: {},
          raw: input,
        },
      };
  }
}