import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { listResearchLabItems } from "@/lib/research-lab/capture";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, {
    limit: 60,
    windowMs: 60_000,
    identifier: `research-lab-list:${user.id}`,
  });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const items = await listResearchLabItems(user.email ?? "");
    return Response.json({ items });
  } catch (error) {
    return toJson(error);
  }
}
