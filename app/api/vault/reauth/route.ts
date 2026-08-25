// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, createEmailPasswordSession } from "@/lib/appwrite/auth";
import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 5, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const password = body.password as string | undefined;

  if (!password || typeof password !== "string") {
    return ApiError.badRequest("VALIDATION_ERROR", "Password is required").toResponse();
  }

  const email = user.email ?? "";
  let verified = false;

  try {
    await createEmailPasswordSession(email, password);
    verified = true;
  } catch {
    // Fallback to Supabase during the transition while both auth systems run.
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) verified = true;
    } catch {
      /* ignore */
    }
  }

  if (!verified) return ApiError.badRequest("REAUTH_FAILED", "Invalid password").toResponse();

  const response = NextResponse.json({ success: true });
  response.cookies.set("vault_reauth", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 15,
    path: "/",
  });

  return response;
}
