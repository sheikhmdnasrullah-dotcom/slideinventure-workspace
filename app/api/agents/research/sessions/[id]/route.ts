import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { getSession } from "@/lib/agents/research/store";

// Poll a research session's live state: status, the round-robin turns, and the
// final conclusion when reached.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  const session = await getSession(id);
  if (!session) return ApiError.notFound("SESSION_NOT_FOUND", "Session not found").toResponse();
  if (session.owner !== (user.email || user.id)) {
    return ApiError.unauthorized().toResponse();
  }
  return Response.json({ session });
}
