import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { getSession, updateSession } from "@/lib/lead-research/store";
import { serializeLeadResearchCsv } from "@/lib/lead-research/csv";
import { z } from "zod";

export const dynamic = "force-dynamic";

const RowPatch = z.object({
  id: z.string().min(1),
  email: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  position: z.string().optional(),
  personalizedInfo: z.string().optional(),
});

const Body = z.object({
  patches: z.array(RowPatch).min(1).max(500),
});

// Edit rows in the lead list (the built-in CSV editor). Supports updating any
// cell including the Personalized Information column.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  const session = await getSession(id);
  if (!session) return ApiError.notFound().toResponse();
  if (session.owner !== (user.email || user.id)) {
    return ApiError.forbidden().toResponse();
  }

  const body = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return ApiError.badRequest("INVALID_BODY", "patches[] is required").toResponse();
  }

  const byId = new Map(parsed.data.patches.map((p) => [p.id, p]));
  const rows = session.rows.map((r) => {
    const patch = byId.get(r.id);
    if (!patch) return r;
    return {
      ...r,
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      ...(patch.firstName !== undefined ? { firstName: patch.firstName } : {}),
      ...(patch.lastName !== undefined ? { lastName: patch.lastName } : {}),
      ...(patch.company !== undefined ? { company: patch.company } : {}),
      ...(patch.position !== undefined ? { position: patch.position } : {}),
      ...(patch.personalizedInfo !== undefined
        ? { personalizedInfo: patch.personalizedInfo, status: "done" as const }
        : {}),
    };
  });

  await updateSession(id, { rows });

  return Response.json({ ok: true, csv: serializeLeadResearchCsv(rows), rows });
}
