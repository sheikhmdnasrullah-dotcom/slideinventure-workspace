import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getAgentPrompt } from "@/lib/agents/roster";
import { runMastraAgent } from "@/lib/agents/mastra";
import { logActivity } from "@/lib/activities/client";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextRequest } from "next/server";

// Agents are powered by DeepSeek (OpenAI-compatible) to match the rest of the
// dashboard's agent fleet. NVIDIA remains available via runMastraAgent's own
// fallback and the gateway.
const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY ?? process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://api.deepseek.com/v1",
});

/**
 * Stateless chat with one installed agent persona (`.claude/agents/<slug>.md`
 * as system prompt). No session/message persistence. The client holds the
 * conversation and resends it each turn. Separate from `/api/chat`, which is
 * the knowledge-base RAG assistant.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { identifier: `agent-chat:${user.id}`, limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => null);
  const { slug, message, history, tools } = (body ?? {}) as {
    slug?: string;
    message?: string;
    history?: Array<{ role: string; content: string }>;
    tools?: boolean;
  };

  if (!slug || typeof slug !== "string") {
    return ApiError.badRequest("MISSING_SLUG", "slug is required").toResponse();
  }
  if (!message?.trim()) {
    return ApiError.badRequest("MISSING_MESSAGE", "message is required").toResponse();
  }

  const agent = getAgentPrompt(slug);
  if (!agent) return ApiError.notFound("AGENT_NOT_FOUND", "Unknown agent").toResponse();

  // Opt-in Mastra mode: persona + tools (retrieve/browse/remember/recall).
  if (tools) {
    const res = await runMastraAgent({ slug, message, history, userEmail: user.email });
    if (!res.ok) {
      await logActivity({
        category: "agents",
        action: "failed",
        title: `${agent.name} run failed`,
        description: res.error ?? "Agent run failed",
        entityId: slug,
        entityType: "agent",
        metadata: { agent: slug, tools: true },
      }).catch(() => {});
      return ApiError.internal("MASTRA_AGENT_FAILED", res.error ?? "agent failed").toResponse();
    }
    await logActivity({
      category: "agents",
      action: "completed",
      title: `${agent.name} run completed`,
      description: res.answer.slice(0, 280),
      entityId: slug,
      entityType: "agent",
      metadata: { agent: slug, tools: res.toolCalls },
    }).catch(() => {});
    return Response.json({ answer: res.answer, agent: res.agentName, tools: res.toolCalls });
  }

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
    const { text: answer } = await generateText({
      model: deepseek(process.env.DEEPSEEK_MODEL || "deepseek-chat"),
      messages,
    });
    await logActivity({
      category: "agents",
      action: "completed",
      title: `${agent.name} run completed`,
      description: answer.slice(0, 280),
      entityId: slug,
      entityType: "agent",
      metadata: { agent: slug, tools: false },
    }).catch(() => {});
    return Response.json({ answer, agent: agent.name });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Agent chat failed";
    await logActivity({
      category: "agents",
      action: "failed",
      title: `${agent.name} run failed`,
      description: errorMessage,
      entityId: slug,
      entityType: "agent",
      metadata: { agent: slug, tools: false },
    }).catch(() => {});
    return ApiError.internal("AGENT_CHAT_FAILED", errorMessage).toResponse();
  }
}
