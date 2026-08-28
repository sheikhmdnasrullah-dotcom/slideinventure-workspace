import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { enqueueAgentJob } from "@/lib/agents/jobs-store";
import { processAgentJob } from "@/lib/agents/worker";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";

const Body = z.object({
  slug: z.string().min(1),
  message: z.string().min(1),
  history: z
    .array(z.object({ role: z.string(), content: z.string() }))
    .optional(),
  tools: z.boolean().optional().default(true),
});

// Background agent runs can take a while; give the server room to finish after
// the response has already been sent to the browser.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const body = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return ApiError.badRequest("INVALID_BODY", "slug and message are required").toResponse();
  }
  const { slug, message, history, tools } = parsed.data;
  const owner = user.email || user.id;

  const job = await enqueueAgentJob({
    slug,
    owner,
    message,
    history: history ?? [],
    tools,
  });

  // Run the agent on the server after responding. This survives the browser
  // closing, a navigation away, or the user's machine being turned off — the
  // job only needs the Appwrite row, which persists independently.
  waitUntil(processAgentJob(job.id));

  return Response.json({ id: job.id, status: job.status });
}
