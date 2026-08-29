import "server-only";
import { databases, ID, Query } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { ensureResearchLabCollection } from "@/lib/brain/ensure";
import { logActivity } from "@/lib/activities/client";
import { chatCompletion } from "@/lib/llm/gateway";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.researchLabItems;

// Where a Brain item came from. The first three are captured outside the
// dashboard (VS Code, terminal, any other AI tool) and arrive via
// /api/brain/ingest; the rest are produced by the dashboard's own sections.
export type ResearchLabSource =
  | "notepad"
  | "brainstorm"
  | "files"
  | "agent"
  | "chat"
  | "terminal"
  | "editor"
  | "external";

export const BRAIN_SOURCES: ResearchLabSource[] = [
  "notepad",
  "brainstorm",
  "files",
  "agent",
  "chat",
  "terminal",
  "editor",
  "external",
];

export function isBrainSource(value: unknown): value is ResearchLabSource {
  return typeof value === "string" && (BRAIN_SOURCES as string[]).includes(value);
}

export type ResearchLabItem = {
  id: string;
  source: ResearchLabSource;
  sourceRef: string;
  title: string;
  summary: string;
  reference: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
};

function serialize(doc: Record<string, unknown>): ResearchLabItem {
  let reference: Record<string, string> | null = null;
  try {
    reference = doc.reference ? JSON.parse(doc.reference as string) : null;
  } catch {
    reference = null;
  }
  return {
    id: doc.$id as string,
    source: doc.source as ResearchLabSource,
    sourceRef: doc.source_ref as string,
    title: (doc.title as string) || "Untitled",
    summary: ((doc.summary as string) || "").replace(/[—–]/g, "-"),
    reference,
    createdAt: doc.created_at as string,
    updatedAt: doc.updated_at as string,
  };
}

export async function listResearchLabItems(userEmail: string): Promise<ResearchLabItem[]> {
  await ensureResearchLabCollection();
  try {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal("user_email", userEmail),
      Query.orderDesc("updated_at"),
      Query.limit(200),
    ]);
    return res.documents.map(serialize);
  } catch {
    return [];
  }
}

export async function deleteResearchLabItem(userEmail: string, id: string): Promise<boolean> {
  await ensureResearchLabCollection();
  try {
    const doc = await databases.getDocument(DB, COL, id);
    if (doc.user_email !== userEmail) return false;
    await databases.deleteDocument(DB, COL, id);
    return true;
  } catch {
    return false;
  }
}

// 10-second push cooldown as requested by user
const MIN_LENGTH = 10;
const COOLDOWN_MS = 10_000;

export type CaptureInput = {
  userEmail: string;
  source: ResearchLabSource;
  sourceRef: string;
  title: string;
  rawText: string;
  reference?: Record<string, string>;
  force?: boolean;
};

function fallbackBulletSummary(title: string, text: string): string {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim().replace(/^[-*•#\d.]+\s*/, "").replace(/[—–]/g, "-"))
    .filter((l) => l.length > 5 && !l.startsWith("{") && !l.startsWith("<"));

  if (lines.length === 0) {
    const clean = text.replace(/[—–]/g, "-").slice(0, 180).trim();
    return `- ${clean || title}`;
  }

  return lines
    .slice(0, 3)
    .map((l) => `- ${l.slice(0, 200)}`)
    .join("\n");
}

async function summarizeContent(title: string, text: string): Promise<string> {
  try {
    const messages = [
      {
        role: "system",
        content:
          "You are an expert research analyst. Extract the core ideas, hypotheses, key findings, or concepts from the content into 2 to 4 structured, concise bullet points (each starting with '- '). No fluff, no preamble. Strict rule: NEVER use em-dashes (—) or en-dashes (–); use standard hyphens (-) or colons (:) only.",
      },
      {
        role: "user",
        content: `Title: ${title}\n\nContent:\n${text.slice(0, 8000)}`,
      },
    ];

    const result = await chatCompletion(messages, { maxTokens: 280, temperature: 0.2 });
    const cleaned = result.replace(/[—–]/g, "-").trim();
    if (cleaned && cleaned !== "(no core idea yet)") {
      return cleaned;
    }
  } catch (err) {
    console.warn("LLM summarization failed in captureResearchInsight, using structured fallback:", err);
  }

  return fallbackBulletSummary(title, text);
}

/**
 * Turns raw content from Notepad, Brainstorm, Files, Chat, an agent run, or an
 * external capture (VS Code, terminal, another AI tool) into one organized
 * Brain item: a short "core idea" summary plus a pointer back to where it came
 * from. Keyed by (source, sourceRef) so repeated edits update the same item in
 * place.
 */
export async function captureResearchInsight(input: CaptureInput): Promise<ResearchLabItem | null> {
  const text = input.rawText.trim();
  if (text.length < MIN_LENGTH && !input.title.trim()) return null;

  await ensureResearchLabCollection();

  let existing: Record<string, unknown> | null = null;
  try {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal("user_email", input.userEmail),
      Query.equal("source", input.source),
      Query.equal("source_ref", input.sourceRef),
      Query.limit(1),
    ]);
    existing = res.documents[0] ?? null;
  } catch {
    existing = null;
  }

  // 10-second cooldown check unless forced
  if (existing && !input.force) {
    const last = new Date((existing.updated_at as string) ?? 0).getTime();
    if (Date.now() - last < COOLDOWN_MS) {
      return serialize(existing);
    }
  }

  const structuredSummary = await summarizeContent(input.title, text || input.title);
  const now = new Date().toISOString();
  const referenceJson = input.reference ? JSON.stringify(input.reference) : null;
  const cleanTitle = input.title.replace(/[—–]/g, "-").slice(0, 200) || "Untitled Research Item";

  try {
    let savedDoc: Record<string, unknown>;
    if (existing) {
      savedDoc = (await databases.updateDocument(DB, COL, existing.$id as string, {
        title: cleanTitle,
        summary: structuredSummary.slice(0, 4000),
        reference: referenceJson,
        updated_at: now,
      } as any)) as unknown as Record<string, unknown>;
    } else {
      savedDoc = (await databases.createDocument(DB, COL, ID.unique(), {
        user_email: input.userEmail,
        source: input.source,
        source_ref: input.sourceRef,
        title: cleanTitle,
        summary: structuredSummary.slice(0, 4000),
        reference: referenceJson,
        created_at: now,
        updated_at: now,
      } as any)) as unknown as Record<string, unknown>;
    }

    logActivity({
      category: "knowledge",
      action: existing ? "updated" : "created",
      title: `Brain: ${cleanTitle}`,
      description: structuredSummary.split("\n")[0]?.replace(/^- /, "") ?? "",
      entityId: input.sourceRef,
      entityType: "research_item",
      source: "research-lab",
      userEmail: input.userEmail,
    }).catch(() => {});

    return serialize(savedDoc);
  } catch (err) {
    console.error("Failed to persist research lab document:", err);
    return null;
  }
}
