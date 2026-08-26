import type { NextRequest } from "next/server"

// Determines whether the browser is on a secure context so we can safely set a
// `Secure` + `SameSite=None` session cookie. Proxies/CDNs (Cloudflare, Vercel
// load balancers, etc.) terminate TLS and forward the request as http, so we must
// trust `x-forwarded-proto` rather than the raw protocol the origin sees.
export function sessionCookieOptions(request: NextRequest) {
  const forwarded = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
  const host = request.nextUrl.hostname
  const isLocalhost =
    host === "localhost" || host === "127.0.0.1" || host === "::1"
  const isSecure =
    forwarded === "https" ||
    request.nextUrl.protocol === "https:" ||
    isLocalhost

  return {
    httpOnly: true as const,
    path: "/",
    sameSite: (isSecure ? "none" : "lax") as "none" | "lax",
    secure: isSecure,
  }
}
