import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { NextRequest } from "next/server";
import { listSendingProfiles, listLandingPages } from "@/lib/gophish";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const [sendingProfiles, landingPages] = await Promise.all([
      listSendingProfiles(),
      listLandingPages(),
    ]);
    return Response.json({ sendingProfiles, landingPages });
  } catch (error) {
    return toJson(error);
  }
}
