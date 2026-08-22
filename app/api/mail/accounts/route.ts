import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getPublicAccounts } from "@/lib/mail/accounts";
import { NextRequest } from "next/server";

export async function GET(_request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(_request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const accounts = getPublicAccounts();
    return Response.json(accounts);
  } catch {
    return ApiError.internal("ACCOUNTS_ERROR", "Failed to load mail accounts").toResponse();
  }
}
