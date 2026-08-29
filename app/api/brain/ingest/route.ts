import { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { verifyInternalSecret } from "@/lib/auth/verify-internal-secret";
import { ingestCapture } from "@/lib/brain/ingest";

// Ingest endpoint for research captured outside the dashboard: the VS Code
// workspace watcher, a terminal hook, or any other AI tool that can POST.
//
// Two accepted identities, no anonymous writes even on localhost:
//   1. A signed-in browser session (cookie), same as every other route here.
//   2. `Authorization: Bearer $INTERNAL_API_SECRET` for callers with no session
//      (CLI, editor watcher). Those must also state which user the capture
//      belongs to via `userEmail`, since there is no session to infer it from.
const Body = z.object({
  source: z.enum(["editor", "terminal", "external"]),
  title: z.string().min(1).max(300),
  text: z.string().min(1).max(200_000),
  path: z.string().max(1000).optional().nullable(),
  tool: z.string().max(100).optional().nullable(),
  userEmail: z.string().email().optional(),
  force: z.array(z.enum(["brain", "files", "notepad", "agents"])).optional(),
});

// The classifier can queue an agent job and the summary is an LLM call, so give
// the handler room rather than letting a slow provider truncate the write.
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const session = await getSessionUser();
  const internal = verifyInternalSecret(request);
  if (!session && !internal) {
    return ApiError.unauthorized("UNAUTHORIZED", "Sign in or send a valid internal secret").toResponse();
  }

  const limit = checkRateLimit(request, {
    limit: 120,
    windowMs: 60_000,
    identifier: `brain-ingest:${session?.id ?? "internal"}`,
  });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const raw = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return ApiError.badRequest("VALIDATION_ERROR", "Invalid capture payload", {
      issues: parsed.error.flatten().fieldErrors,
    }).toResponse();
  }
  const body = parsed.data;

  // A session always wins over a caller-supplied address, so a leaked secret
  // cannot be used to write into another account through a logged-in browser.
  const userEmail = session?.email || body.userEmail;
  if (!userEmail) {
    return ApiError.badRequest("MISSING_USER", "userEmail is required for internal callers").toResponse();
  }

  try {
    const result = await ingestCapture({
      userEmail,
      source: body.source,
      title: body.title,
      text: body.text,
      path: body.path ?? null,
      tool: body.tool ?? null,
      force: body.force,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return toJson(error);
  }
}
