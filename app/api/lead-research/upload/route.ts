import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { z } from "zod";
import { parseLeadResearchCsv, serializeLeadResearchCsv } from "@/lib/lead-research/csv";
import { createSession } from "@/lib/lead-research/store";
import { getResearchTeam } from "@/lib/lead-research/research";

export const dynamic = "force-dynamic";

const Body = z.object({
  fileName: z.string().min(1).max(255).default("leads.csv"),
  csv: z.string().min(1),
  agentSlugs: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return ApiError.badRequest("INVALID_BODY", "csv is required").toResponse();
  }

  let csv;
  try {
    csv = parseLeadResearchCsv(parsed.data.csv);
  } catch (e) {
    return ApiError.badRequest(
      "INVALID_CSV",
      e instanceof Error ? e.message : "Invalid CSV"
    ).toResponse();
  }

  if (csv.rows.length === 0) {
    return ApiError.badRequest("NO_ROWS", "No valid lead rows found in the CSV").toResponse();
  }

  const team = getResearchTeam();
  const agentSlugs =
    parsed.data.agentSlugs && parsed.data.agentSlugs.length > 0
      ? parsed.data.agentSlugs
      : team.map((a) => a.slug).slice(0, 12);

  const session = await createSession({
    owner: user.email || user.id,
    fileName: parsed.data.fileName,
    rows: csv.rows,
    discoveredColumns: csv.discoveredColumns,
    agentSlugs,
  });

  return Response.json({
    ok: true,
    ...session,
    previewCsv: serializeLeadResearchCsv(session.rows),
  });
}
