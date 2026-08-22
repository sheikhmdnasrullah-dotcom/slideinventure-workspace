import { NextRequest } from "next/server";

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anon"
  );
}

export function getUserAgent(request: NextRequest): string | undefined {
  return request.headers.get("user-agent") ?? undefined;
}
