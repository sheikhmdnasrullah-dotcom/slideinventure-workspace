import { timingSafeEqual } from "node:crypto";

// For routes called by trusted external callers with no user session
// (n8n webhooks, terminal/CLI scripts) — checks `Authorization: Bearer <secret>`
// against INTERNAL_API_SECRET.
export function verifyInternalSecret(request: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
