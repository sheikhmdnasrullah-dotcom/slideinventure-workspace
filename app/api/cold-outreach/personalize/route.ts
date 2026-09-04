import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { personalizeLeads, type PersonalizeLead } from "@/lib/cold-outreach/agentPersonalize";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, {
    identifier: `cold-outreach-personalize:${user.id}`,
    limit: 5,
    windowMs: 60_000,
  });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = (await request.json().catch(() => null)) as {
    template?: string;
    subject?: string;
    placeholders?: string[];
    leads?: PersonalizeLead[];
    agentSlug?: string;
    useWebSearch?: boolean;
  } | null;
  if (!body || typeof body.template !== "string" || !Array.isArray(body.leads)) {
    return ApiError.badRequest("MISSING_FIELDS", "template and leads[] are required").toResponse();
  }

  try {
    const rows = await personalizeLeads({
      template: body.template,
      subject: body.subject,
      placeholders: body.placeholders ?? ["FirstName", "Company"],
      leads: body.leads,
      agentSlug: body.agentSlug,
      useWebSearch: body.useWebSearch ?? true,
    });
    return Response.json({ ok: true, rows });
  } catch (err) {
    return toJson(err);
  }
}
