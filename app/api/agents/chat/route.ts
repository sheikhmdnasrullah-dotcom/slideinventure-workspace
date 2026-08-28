import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getAgentPrompt } from "@/lib/agents/roster";
import { runMastraAgent } from "@/lib/agents/mastra";
import { generateText, type ModelMessage } from "ai";
import { NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { NoLlmProviderError, resolveChatModel } from "@/lib/llm/models";
import { captureResearchInsight } from "@/lib/research-lab/capture";
import {
  agentRunCompleted,
  agentRunFailed,
  agentRunStarted,
  agentThinking,
  agentToolStarted,
  type AgentRunContext,
} from "@/lib/agui/server";

/**
 * Stateless chat with one installed agent persona (`.claude/agents/<slug>.md`
 * as system prompt). No session/message persistence: the client holds the
 * conversation and resends it each turn. Separate from `/api/chat`, which is the
 * knowledge-base RAG assistant.
 *
 * Every run emits AG-UI lifecycle events through lib/agui/server, so the
 * dashboard and activity feed show the run live rather than only after it ends.
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

  const ctx: AgentRunContext = {
    runId: crypto.randomUUID(),
    agent: agent.name,
    userEmail: user.email,
  };

  await agentRunStarted(ctx, message.slice(0, 200));

  // Opt-in Mastra mode: persona + tools (retrieve/browse/remember/recall).
  if (tools) {
    agentToolStarted(ctx, "tools");
    const res = await runMastraAgent({ slug, message, history, userEmail: user.email });
    if (!res.ok) {
      await agentRunFailed(ctx, res.error ?? "Agent run failed");
      return ApiError.internal("MASTRA_AGENT_FAILED", res.error ?? "agent failed").toResponse();
    }
    await agentRunCompleted(ctx, res.answer.slice(0, 280));
    if (user.email) {
      waitUntil(
        captureResearchInsight({
          userEmail: user.email,
          source: "agent",
          sourceRef: ctx.runId,
          title: `${agent.name}: ${message.slice(0, 80)}`,
          rawText: `Task: ${message}\n\nResult: ${res.answer}`,
          reference: { tab: "agents" },
        }).catch(() => {})
      );
    }
    return Response.json({
      answer: res.answer,
      agent: res.agentName,
      tools: res.toolCalls,
      runId: ctx.runId,
    });
  }

  const priorTurns: ModelMessage[] = Array.isArray(history)
    ? history
        .filter(
          (m) =>
            (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
        )
        .slice(-20)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
    : [];

  const messages: ModelMessage[] = [
    { role: "system", content: agent.prompt },
    ...priorTurns,
    { role: "user", content: message },
  ];

  try {
    agentThinking(ctx);
    const { text: answer } = await generateText({
      model: resolveChatModel(),
      messages,
    });
    await agentRunCompleted(ctx, answer.slice(0, 280));
    return Response.json({ answer, agent: agent.name, runId: ctx.runId });
  } catch (err) {
    const errorMessage =
      err instanceof NoLlmProviderError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Agent chat failed";
    await agentRunFailed(ctx, errorMessage);
    const status = err instanceof NoLlmProviderError ? 503 : 500;
    return Response.json({ error: errorMessage }, { status });
  }
}
