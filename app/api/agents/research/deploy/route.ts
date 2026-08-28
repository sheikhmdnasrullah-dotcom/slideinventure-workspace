import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { z } from "zod";
import { createSession, getSessionForNote, updateSession } from "@/lib/agents/research/store";
import { getResearchPersona } from "@/lib/agents/research/personas";
import { runResearchSession } from "@/lib/agents/research/orchestrator";
import { waitUntil } from "@vercel/functions";

const Body = z.object({
  agents: z.array(z.string()).min(1).max(4),
  noteId: z.string().optional(),
  task: z.string().optional(),
});

export const maxDuration = 300;

// Deploy research agent(s) into a target. When noteId is supplied the session is
// bound to that note (the Notepad side panel picks it up and can write the
// conclusion back). Otherwise it becomes a standalone "research super agent"
// shown in the Agents section. Re-deploying to the same note reuses the session
// if it is still running.
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const body = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return ApiError.badRequest("INVALID_BODY", "agents are required").toResponse();
  }
  const { agents, noteId, task } = parsed.data;
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

  let sessionId: string;

  if (noteId) {
    const existing = await getSessionForNote(noteId);
    if (existing && existing.status !== "done" && existing.status !== "error") {
      // Reuse the in-flight session; make sure the requested agents are set.
      await updateSession(existing.id, { agents: refs, task: task ?? existing.task });
      sessionId = existing.id;
    } else {
      const session = await createSession({
        owner,
        task: task || "Research the selected note",
        agents: refs,
        noteId,
      });
      sessionId = session.id;
    }
  } else {
    const session = await createSession({
      owner,
      task: task || "Research task",
      agents: refs,
      noteId: null,
    });
    sessionId = session.id;
  }

  waitUntil(runResearchSession(sessionId));
  return Response.json({ id: sessionId, noteId: noteId ?? null });
}
