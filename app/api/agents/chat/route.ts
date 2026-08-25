import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { nvidiaComplete } from "@/lib/llm/nvidia";
import { getAgentPrompt } from "@/lib/agents/roster";
import { NextRequest } from "next/server";

/**
 * Stateless chat with one installed agent persona (`.claude/agents/<slug>.md`
 * as system prompt). No session/message persistence — the client holds the
 * conversation and resends it each turn. Separate from `/api/chat`, which is
 * the knowledge-base RAG assistant.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { identifier: `agent-chat:${user.id}`, limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => null);
  const { slug, message, history } = (body ?? {}) as {
    slug?: string;
    message?: string;
    history?: Array<{ role: string; content: string }>;
  };

  if (!slug || typeof slug !== "string") {
    return ApiError.badRequest("MISSING_SLUG", "slug is required").toResponse();
  }
  if (!message?.trim()) {
    return ApiError.badRequest("MISSING_MESSAGE", "message is required").toResponse();
  }

  const agent = getAgentPrompt(slug);
  if (!agent) return ApiError.notFound("AGENT_NOT_FOUND", "Unknown agent").toResponse();

  const priorTurns = Array.isArray(history)
    ? history
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-20)
    : [];

  const messages = [
    { role: "system", content: agent.prompt },
    ...priorTurns,
    { role: "user", content: message },
  ];

  try {
    const answer = await nvidiaComplete(messages);
    return Response.json({ answer, agent: agent.name });
  } catch (err) {
    return ApiError.internal("AGENT_CHAT_FAILED", err instanceof Error ? err.message : "Agent chat failed").toResponse();
  }
}
