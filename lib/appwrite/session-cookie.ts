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
  const isHttps =
    forwarded === "https" || request.nextUrl.protocol === "https:"

  // `Secure` may only be true over a real TLS connection. Marking an http://
  // cookie Secure makes the browser drop it, so the a_session_* cookie never
  // reaches the API routes and every request 401s. SameSite=None also requires
  // Secure, so over plain http we use Lax (correct for same-origin API calls).
  return {
    httpOnly: true as const,
    path: "/",
    sameSite: (isHttps ? "none" : "lax") as "none" | "lax",
    secure: isHttps,
  }
}
