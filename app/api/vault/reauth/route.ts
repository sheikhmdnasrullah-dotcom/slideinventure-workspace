// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { Client, Account } from "node-appwrite";
import { getSessionUser, createEmailPasswordSession } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";

const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1";
const PROJECT = process.env.APPWRITE_PROJECT_ID || "6a8cf7090015800700cc";

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
    const session = await createEmailPasswordSession(email, password);
    verified = true;
    // Clean up the transient verification session so it doesn't linger.
    try {
      const acct = new Account(new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setSession(session.secret));
      await acct.deleteSession("current");
    } catch {
      /* ignore cleanup failure */
    }
  } catch {
    verified = false;
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
