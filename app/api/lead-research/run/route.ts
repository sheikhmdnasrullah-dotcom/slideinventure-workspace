import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { getSession, updateSession } from "@/lib/lead-research/store";
import { runResearchSession } from "@/lib/lead-research/research";
import { waitUntil } from "@vercel/functions";

export const maxDuration = 300;

// Begin (or resume) the background agent run that researches every lead in the
// session and fills in the "Personalized Information" column. Even if the
// browser closes, the agents keep working through the list in the backend.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  const session = await getSession(id);
  if (!session) return ApiError.notFound().toResponse();

  if (session.owner !== (user.email || user.id)) {
    return ApiError.forbidden().toResponse();
  }

  // Start asynchronously so the HTTP request returns immediately while the
  // agents work through the whole list in the backend.
  waitUntil(
    runResearchSession(id).catch((e) => {
      console.error("[lead-research] run failed", id, e);
      return updateSession(id, { status: "error" });
    })
  );

  return Response.json({ ok: true, id, status: "running" });
}
