import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { getAgentRoster, getAgentDivisions } from "@/lib/agents/roster";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const agents = getAgentRoster();
  const divisions = getAgentDivisions(agents);

  return Response.json({
    agents: agents.map((a) => ({
      slug: a.slug,
      name: a.name,
      description: a.description,
      division: a.division,
      team: a.team,
      emoji: a.emoji,
      color: a.color,
    })),
    divisions,
  });
}
