import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getAgentPrompt } from "@/lib/agents/roster";
import { runMastraAgent } from "@/lib/agents/mastra-client";
import { generateText, type ModelMessage } from "ai";
import { NextRequest } from "next/server";
import { NoLlmProviderError, resolveChatModel } from "@/lib/llm/models";
import { chatCompletion } from "@/lib/llm/gateway";
import { captureResearchInsight } from "@/lib/brain/capture";
import {
  agentRunCompleted,
  agentRunFailed,
  agentRunStarted,
  agentThinking,
  agentToolStarted,
  type AgentRunContext,
} from "@/lib/agui/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const { slug, message, history, tools, context } = (body ?? {}) as {
    slug?: string;
    message?: string;
    history?: Array<{ role: string; content: string }>;
    tools?: boolean;
    context?: string;
  };

  if (!slug || typeof slug !== "string") {
    return ApiError.badRequest("MISSING_SLUG", "slug is required").toResponse();
  }
  if (!message?.trim()) {
    return ApiError.badRequest("MISSING_MESSAGE", "message is required").toResponse();
  }

  const isMastra = Boolean(tools);
  const persona = isMastra ? null : getAgentPrompt(slug);
  if (!isMastra && !persona) {
    return ApiError.notFound("AGENT_NOT_FOUND", "Unknown agent").toResponse();
  }

  const ctx: AgentRunContext = {
    runId: crypto.randomUUID(),
    agent: persona?.name ?? slug,
    userEmail: user.email,
  };

  await agentRunStarted(ctx, message.slice(0, 200));

  // Mastra mode: persona + tools run entirely on the self-hosted server, so no
  // local persona file is required (the server owns the agent definition).
  if (isMastra) {
    agentToolStarted(ctx, "tools");
    const mMessage =
      context && context.trim()
        ? `SECTION CONTEXT (source of truth for the user's work):\n${context.trim().slice(0, 12000)}\n\nTASK: ${message}`
        : message;
    const res = await runMastraAgent({ slug, message: mMessage, history, userEmail: user.email });
    if (!res.ok) {
      await agentRunFailed(ctx, res.error ?? "Agent run failed");
      return ApiError.internal("MASTRA_AGENT_FAILED", res.error ?? "agent failed").toResponse();
    }
    await agentRunCompleted(ctx, res.answer.slice(0, 280));
    if (user.email) {
      void captureResearchInsight({
        userEmail: user.email,
        source: "agent",
        sourceRef: ctx.runId,
        title: `${slug}: ${message.slice(0, 80)}`,
        rawText: `Task: ${message}\n\nResult: ${res.answer}`,
        reference: { tab: "agents" },
      }).catch((err) => console.error("CAPTURE_AGENT_ERROR:", err));
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

  const contextBlock =
    context && context.trim()
      ? `\n\n---\nSECTION CONTEXT (you are deployed into this section; treat it as the source of truth for the user's current work):\n${context.trim().slice(0, 12000)}\n---`
      : "";

  const messages: ModelMessage[] = [
    { role: "system", content: (persona!.prompt || "") + contextBlock },
    ...priorTurns,
    { role: "user", content: message },
  ];

  try {
    agentThinking(ctx);
    let answer = "";
    try {
      answer = await chatCompletion(
        messages.map((m) => ({
          role: m.role as string,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        })),
        { maxTokens: 2048, temperature: 0.3 }
      );
    } catch (llmErr) {
      console.warn("chatCompletion failed, trying generateText:", llmErr);
      const { text } = await generateText({
        model: resolveChatModel(),
        messages,
      });
      answer = text;
    }

    const cleanAnswer = (answer || "").replace(/[—–]/g, "-");
    await agentRunCompleted(ctx, cleanAnswer.slice(0, 280));
    if (user.email) {
      void captureResearchInsight({
        userEmail: user.email,
        source: "agent",
        sourceRef: ctx.runId,
        title: `${persona!.name}: ${message.slice(0, 80)}`,
        rawText: `Task: ${message}\n\nResult: ${cleanAnswer}`,
        reference: { tab: "agents" },
      }).catch((err) => console.error("CAPTURE_AGENT_ERROR:", err));
    }
    return Response.json({ answer: cleanAnswer, agent: persona!.name, runId: ctx.runId });
  } catch (err) {
    const errorMessage =
      err instanceof NoLlmProviderError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Agent chat failed";
    await agentRunFailed(ctx, errorMessage);
    const status = err instanceof NoLlmProviderError ? 503 : 500;
    return new Response(JSON.stringify({ error: errorMessage }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
