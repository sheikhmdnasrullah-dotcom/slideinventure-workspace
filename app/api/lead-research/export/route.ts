import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { getSession } from "@/lib/lead-research/store";
import { serializeLeadResearchCsv } from "@/lib/lead-research/csv";

export const dynamic = "force-dynamic";

// Download the revised list with the filled-in "Personalized Information"
// column as a CSV file.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  const session = await getSession(id);
  if (!session) return ApiError.notFound().toResponse();
  if (session.owner !== (user.email || user.id)) {
    return ApiError.forbidden().toResponse();
  }

  const csv = serializeLeadResearchCsv(session.rows);
  const safeName = session.fileName.replace(/[^\w.-]+/g, "-") || "leads.csv";
  const fileName = safeName.replace(/\.csv$/i, "") + "-researched.csv";

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
