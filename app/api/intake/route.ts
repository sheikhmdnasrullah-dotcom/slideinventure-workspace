import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import {
  getBusinessProfile,
  isIntakeComplete,
  saveBusinessProfile,
} from "@/lib/intake/store";

function guard(request: NextRequest) {
  return checkRateLimit(request, { limit: 30, windowMs: 60_000 });
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = guard(request);
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const profile = getBusinessProfile();
    if (!profile) return ApiError.notFound("INTAKE_MISSING", "No business profile yet").toResponse();
    return Response.json({ completed: isIntakeComplete(), profile });
  } catch (error) {
    return toJson(error);
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = guard(request);
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const body: unknown = await request.json().catch(() => null);
    const profile = saveBusinessProfile(body);
    return Response.json({ completed: true, profile });
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiError.badRequest("INTAKE_INVALID", "Profile did not validate", {
        issues: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      }).toResponse();
    }
    return toJson(error);
  }
}
