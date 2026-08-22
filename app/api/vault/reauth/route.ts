import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 5, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const password = body.password as string | undefined;

  if (!password || typeof password !== "string") {
    return ApiError.badRequest("VALIDATION_ERROR", "Password is required").toResponse();
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: user.email ?? "",
    password,
  });

  if (error) {
    return ApiError.badRequest("REAUTH_FAILED", "Invalid password").toResponse();
  }

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
