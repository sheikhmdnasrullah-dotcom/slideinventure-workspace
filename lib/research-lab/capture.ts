import "server-only";
import { databases, ID, Query } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { ensureResearchLabCollection } from "@/lib/research-lab/ensure";
import { logActivity } from "@/lib/activities/client";
import { nvidiaComplete } from "@/lib/llm/nvidia";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.researchLabItems;

export type ResearchLabSource = "notepad" | "brainstorm" | "files" | "agent";

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
    summary: (doc.summary as string) || "",
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

const MIN_LENGTH = 40;
const COOLDOWN_MS = 45_000;

export type CaptureInput = {
  userEmail: string;
  source: ResearchLabSource;
  sourceRef: string;
  title: string;
  rawText: string;
  reference?: Record<string, string>;
};

/**
 * Turns raw content from Notepad, Brainstorm, Files, or an agent run into one
 * organized Research Lab item: a short "core idea" summary plus a pointer back
 * to where it came from. Keyed by (source, sourceRef) so repeated edits update
 * the same item in place instead of scattering duplicates across the canvas.
 * Fire-and-forget from every call site: never throws, never blocks the
 * primary save/run it was triggered by.
 */
export async function captureResearchInsight(input: CaptureInput): Promise<void> {
  const text = input.rawText.trim();
  if (text.length < MIN_LENGTH) return;

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

  // A brand-new item always captures immediately; a re-edit of something
  // already captured waits out a cooldown so autosave-on-every-keystroke
  // doesn't fire an LLM call per keystroke.
  if (existing) {
    const last = new Date((existing.updated_at as string) ?? 0).getTime();
    if (Date.now() - last < COOLDOWN_MS) return;
  }

  let summary: string;
  try {
    summary = await nvidiaComplete(
      [
        {
          role: "system",
          content:
            'Extract only the core idea from the given content as 2-4 short bullet points (each starting with "- "). No preamble, no restating the source, no fluff. If the content has no substantive idea yet, respond with exactly: (no core idea yet)',
        },
        { role: "user", content: text.slice(0, 6000) },
      ],
      { maxTokens: 220 }
    );
  } catch {
    return; // no LLM available; skip rather than store raw, unsummarized text
  }

  const trimmedSummary = summary.trim();
  if (!trimmedSummary || trimmedSummary === "(no core idea yet)") return;

  const now = new Date().toISOString();
  const referenceJson = input.reference ? JSON.stringify(input.reference) : null;

  try {
    if (existing) {
      await databases.updateDocument(DB, COL, existing.$id as string, {
        title: input.title.slice(0, 200),
        summary: trimmedSummary.slice(0, 4000),
        reference: referenceJson,
        updated_at: now,
      });
    } else {
      await databases.createDocument(DB, COL, ID.unique(), {
        user_email: input.userEmail,
        source: input.source,
        source_ref: input.sourceRef,
        title: input.title.slice(0, 200),
        summary: trimmedSummary.slice(0, 4000),
        reference: referenceJson,
        created_at: now,
        updated_at: now,
      });
    }
  } catch {
    return;
  }

  logActivity({
    category: "knowledge",
    action: existing ? "updated" : "created",
    title: `Research Lab: ${input.title}`,
    description: trimmedSummary.split("\n")[0]?.replace(/^- /, "") ?? "",
    entityId: input.sourceRef,
    entityType: "research_item",
    source: "research-lab",
    userEmail: input.userEmail,
  }).catch(() => {});
}
