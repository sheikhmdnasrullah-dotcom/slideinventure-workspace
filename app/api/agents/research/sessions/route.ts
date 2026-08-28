import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { z } from "zod";
import { createSession, getSessionForNote } from "@/lib/agents/research/store";
import { getResearchPersona } from "@/lib/agents/research/personas";
import { runResearchSession } from "@/lib/agents/research/orchestrator";
import { waitUntil } from "@vercel/functions";

const Body = z.object({
  task: z.string().min(1),
  agents: z.array(z.string()).min(1).max(4),
  noteId: z.string().optional(),
});

export const maxDuration = 300;

// Create a research session (task + selected research agents) and run it in the
// background via waitUntil. Returns the session id to poll.
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const body = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return ApiError.badRequest("INVALID_BODY", "task and 1-4 agents are required").toResponse();
  }
  const { task, agents, noteId } = parsed.data;
  const owner = user.email || user.id;

  const refs = agents
    .map((slug, i) => {
      const persona = getResearchPersona(slug);
      if (!persona) return null;
      return { slug: persona.slug, label: `Research Agent ${String.fromCharCode(65 + i)}` };
    })
    .filter(Boolean) as { slug: string; label: string }[];

  if (refs.length === 0) {
    return ApiError.badRequest("NO_AGENTS", "No valid research agents selected").toResponse();
  }

  const session = await createSession({ owner, task, agents: refs, noteId: noteId ?? null });
  waitUntil(runResearchSession(session.id));
  return Response.json({ id: session.id, noteId: session.noteId });
}

// GET ?noteId=... -> the session bound to a note. Otherwise lists the user's
// sessions (used by the Agents section for "research super agents").
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const noteId = request.nextUrl.searchParams.get("noteId");
  if (noteId) {
    const session = await getSessionForNote(noteId);
    if (!session) return Response.json({ session: null });
    return Response.json({ session });
  }

  const { databases, Query } = await import("@/lib/appwrite/server");
  const DB = (await import("@/lib/appwrite/config")).APPWRITE.databaseId;
  const COL = "research_sessions";
  try {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal("owner", user.email || user.id),
      Query.orderDesc("$createdAt"),
      Query.limit(50),
    ]);
    const all = res.documents as any[];
    return Response.json({
      sessions: all.map((d) => ({
        id: d.$id,
        status: d.status,
        task: d.task,
        agents: JSON.parse(d.agents || "[]"),
        turns: JSON.parse(d.turns || "[]"),
        conclusion: d.conclusion || null,
        noteId: d.noteId || null,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      })),
    });
  } catch {
    return Response.json({ sessions: [] });
  }
}
