import "server-only";
import { databases, ID, Query } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { captureResearchInsight, type ResearchLabItem, type ResearchLabSource } from "@/lib/brain/capture";
import { classifyCapture, type BrainDestination, type ClassifyInput } from "@/lib/brain/classify";
import { logActivity } from "@/lib/activities/client";
import { enqueueAgentJob } from "@/lib/agents/jobs-store";
import { getAgentRoster } from "@/lib/agents/roster";
import { writeFileContent } from "../../AI Venture/next-integration/lib/ai-venture/fs";

const DB = APPWRITE.databaseId;
const NOTES = APPWRITE.collections.notes;

// Everything captured from outside the dashboard lands under one folder in the
// AI Venture file tree, so it never mixes with files the user placed by hand.
const CAPTURE_FOLDER = "Captured";

export type IngestInput = {
  userEmail: string;
  /** "editor" (VS Code), "terminal", or "external" (any other AI tool). */
  source: Extract<ResearchLabSource, "editor" | "terminal" | "external">;
  title: string;
  text: string;
  /** Path of the file the text came from, relative to the research workspace. */
  path?: string | null;
  /** Free-form origin label, e.g. "vscode", "aider", "claude-code". */
  tool?: string | null;
  /** Skips classification and writes to exactly these destinations (+ Brain). */
  force?: BrainDestination[];
};

export type IngestResult = {
  destinations: BrainDestination[];
  reasons: string[];
  brainItem: ResearchLabItem | null;
  filePath: string | null;
  noteId: string | null;
  agentJobId: string | null;
  warnings: string[];
};

/** `Captured/<sanitized path>`; falls back to the title when there is no path. */
function capturePathFor(input: IngestInput): string {
  const raw = (input.path || input.title || "capture.md").replace(/\\/g, "/");
  const segments = raw
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s && s !== "." && s !== "..")
    .map((s) => s.replace(/[^A-Za-z0-9._ -]/g, "-"));
  const cleaned = segments.join("/") || "capture.md";
  const withExt = /\.[A-Za-z0-9]+$/.test(cleaned) ? cleaned : `${cleaned}.md`;
  return `${CAPTURE_FOLDER}/${withExt}`;
}

/** Note titles are keyed on the capture path so re-saves update in place. */
function noteTitleFor(input: IngestInput): string {
  const base = input.path || input.title || "Captured note";
  return base.split("/").pop()!.replace(/\.[A-Za-z0-9]+$/, "").slice(0, 200);
}

/**
 * Notes store their body as serialized BlockNote JSON (see notepad-view), so
 * plain captured text has to be wrapped in paragraph blocks or the editor
 * renders an empty note.
 */
function textToBlockNote(text: string): string {
  const blocks = text
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)
    .map((line) => ({
      id: randomUUID(),
      type: "paragraph",
      props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
      content: [{ type: "text", text: line, styles: {} }],
      children: [],
    }));
  return JSON.stringify(blocks);
}

async function upsertVentureNote(
  userEmail: string,
  title: string,
  text: string
): Promise<string | null> {
  const content = textToBlockNote(text);
  const now = new Date().toISOString();
  try {
    const existing = await databases.listDocuments(DB, NOTES, [
      Query.equal("user_email", userEmail),
      Query.equal("scope", "ai-venture"),
      Query.equal("title", title),
      Query.limit(1),
    ]);
    if (existing.documents.length > 0) {
      const id = existing.documents[0].$id;
      await databases.updateDocument(DB, NOTES, id, { content, updated_at: now });
      return id;
    }
    const doc = await databases.createDocument(DB, NOTES, ID.unique(), {
      user_email: userEmail,
      title,
      content,
      scope: "ai-venture",
      tags: [],
      links: [],
      created_at: now,
      updated_at: now,
    });
    return doc.$id;
  } catch (err) {
    console.warn("[brain/ingest] note upsert failed:", err);
    return null;
  }
}

/**
 * Picks the agent that should execute a captured directive. Uses the installed
 * roster rather than a hardcoded slug, so this keeps working when personas are
 * added or removed; returns null when no agent is installed.
 */
function pickExecutionAgent(): string | null {
  try {
    const roster = getAgentRoster();
    if (roster.length === 0) return null;
    const preferred = roster.find((a) => a.slug === "mastra-researcher");
    return (preferred ?? roster[0]).slug;
  } catch {
    return null;
  }
}

/** Pulls the directive lines out so the agent gets the task, not the whole document. */
function extractDirectives(text: string): string {
  const lines = text
    .split("\n")
    .filter(
      (l) =>
        /^\s*(?:[-*+]\s*)?(?:\[ \]\s*)?(?:TODO|ACTION|NEXT|AGENT|RUN|DO)\s*[::-]/i.test(l) ||
        /(^|\s)@agent\b/i.test(l)
    )
    .map((l) => l.trim());
  return lines.slice(0, 20).join("\n");
}

/**
 * Single entry point for research captured outside the dashboard.
 *
 * Classifies the capture with explicit rules (lib/brain/classify), then fans it
 * out: the bullet summary always goes to the Brain; a real file is mirrored
 * into Files; note-like prose is mirrored into Notepad; an explicit directive
 * becomes a queued agent job, which the existing agent pipeline reports into
 * Agents Activity on its own.
 *
 * Every destination is best-effort and isolated: one failing write never stops
 * the others, and the failures come back in `warnings`.
 */
export async function ingestCapture(input: IngestInput): Promise<IngestResult> {
  const text = input.text.trim();
  const warnings: string[] = [];

  const classifyInput: ClassifyInput = {
    title: input.title,
    text,
    source: input.source,
    path: input.path ?? null,
    force: input.force,
  };
  const { destinations, reasons } = classifyCapture(classifyInput);

  const sourceRef = input.path ? `${input.source}:${input.path}` : `${input.source}:${input.title}`;
  const reference: Record<string, string> = { tab: "research" };
  if (input.tool) reference.tool = input.tool;
  if (input.path) reference.origin = input.path;

  let filePath: string | null = null;
  if (destinations.includes("files")) {
    const target = capturePathFor(input);
    try {
      await writeFileContent(target, text, "utf-8");
      filePath = target;
      reference.tab = "files";
      reference.path = target;
    } catch (err) {
      warnings.push(`Files: ${err instanceof Error ? err.message : "write failed"}`);
    }
  }

  let noteId: string | null = null;
  if (destinations.includes("notepad")) {
    noteId = await upsertVentureNote(input.userEmail, noteTitleFor(input), text);
    if (noteId) {
      reference.tab = "notepad";
      reference.note = noteId;
    } else {
      warnings.push("Notepad: could not save the note");
    }
  }

  let agentJobId: string | null = null;
  if (destinations.includes("agents")) {
    const slug = pickExecutionAgent();
    if (!slug) {
      warnings.push("Agents: no agent persona installed, nothing queued");
    } else {
      const directives = extractDirectives(text) || text.slice(0, 2000);
      try {
        const job = await enqueueAgentJob({
          slug,
          owner: input.userEmail,
          message: `From ${input.tool || input.source} capture "${input.title}":\n\n${directives}`,
          history: [],
          tools: true,
        });
        agentJobId = job.id;
        // The run itself emits its own agent.* activity when the worker picks
        // it up; this row is what makes the queuing visible immediately.
        await logActivity({
          category: "agents",
          action: "created",
          title: `Queued from capture: ${input.title.slice(0, 80)}`,
          description: directives.slice(0, 280),
          entityId: job.id,
          entityType: "agent_run",
          source: "agents",
          userEmail: input.userEmail,
          metadata: { slug, origin: input.source, tool: input.tool ?? null },
        });
      } catch (err) {
        warnings.push(`Agents: ${err instanceof Error ? err.message : "could not queue the job"}`);
      }
    }
  }

  // Brain last, so its reference points at wherever the content actually landed.
  const brainItem = await captureResearchInsight({
    userEmail: input.userEmail,
    source: input.source,
    sourceRef,
    title: input.title,
    rawText: text,
    reference,
    force: true,
  }).catch((err) => {
    warnings.push(`Brain: ${err instanceof Error ? err.message : "capture failed"}`);
    return null;
  });

  return { destinations, reasons, brainItem, filePath, noteId, agentJobId, warnings };
}

    return null;
  }
}
