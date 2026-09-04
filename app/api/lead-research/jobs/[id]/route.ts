import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { getSession } from "@/lib/lead-research/store";
import { serializeLeadResearchCsv } from "@/lib/lead-research/csv";

export const dynamic = "force-dynamic";

// Poll a lead research session to see progress and results as the agents work
// through the list in the backend. Also returns the enriched CSV.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  const session = await getSession(id);
  if (!session) return ApiError.notFound().toResponse();

  if (session.owner !== (user.email || user.id)) {
    return ApiError.forbidden().toResponse();
  }

  return Response.json({
    ok: true,
    session: {
      ...session,
      csv: serializeLeadResearchCsv(session.rows),
    },
  });
}
