import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { getAgentRoster } from "@/lib/agents/roster";

// Lists the installed agent personas (`.claude/agents/*.md`). The roster is
// server-only, so the client cannot read it directly; this endpoint is the
// single source of truth the Agents section lists from. It is intentionally
// honest: an empty persona directory returns an empty list, not a fallback.
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  try {
    const agents = getAgentRoster();
    return Response.json({ agents });
  } catch {
    return Response.json({ agents: [] });
  }
}
