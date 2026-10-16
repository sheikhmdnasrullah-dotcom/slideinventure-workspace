import { stepCountIs, streamText, type ModelMessage } from "ai";
import { NextRequest } from "next/server";
import { NoLlmProviderError, resolveChatModel } from "@/lib/llm/models";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import {
  PROJECT_ASSISTANT_SYSTEM_PROMPT,
  assembleContext,
  buildProjectTools,
  type ContextSelection,
} from "@/lib/project-workspace/assistant";
import { getProjectStore, requireProjectUser, workspaceErrorToResponse } from "../../_shared";

type Params = { params: Promise<{ id: string }> };

// useChat (AI SDK v5 UI messages) sends `parts`; convert text parts only.
function toModelMessages(messages: unknown[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const m of messages) {
    const msg = m as {
      role?: string;
      parts?: { type: string; text?: string }[];
      content?: unknown;
    };
    const content = Array.isArray(msg.parts)
      ? msg.parts
          .filter((p) => p.type === "text")
          .map((p) => p.text ?? "")
          .join("")
      : typeof msg.content === "string"
        ? msg.content
        : "";
    if (!content) continue;
    if (msg.role === "user" || msg.role === "assistant" || msg.role === "system") {
      out.push({ role: msg.role, content } as ModelMessage);
    }
  }
  return out;
}

/**
 * POST → streaming project-aware chat. Body: { messages, context?: { openFile, pinned[], extra[] } }.
 * The selected context is prepended to the latest user message; the model can
 * also pull any project file through tools. Edits are proposals only.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000, identifier: `pw-assistant:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id } = await params;
    const store = getProjectStore();
    // Ownership check before any model/tool work.
    const project = store.getProject(user.id, id);

    const body = (await request.json().catch(() => ({}))) as {
      messages?: unknown[];
      context?: ContextSelection;
    };
    const messages = toModelMessages(Array.isArray(body.messages) ? body.messages : []);
    if (messages.length === 0) {
      return ApiError.badRequest("MESSAGES_REQUIRED", "messages is required").toResponse();
    }

    const ctx = { store, ownerId: user.id, projectId: id, actorEmail: user.email };
    const { block, notices } = await assembleContext(ctx, body.context ?? {});
    if (block) {
      const last = messages[messages.length - 1]!;
      if (last.role === "user" && typeof last.content === "string") {
        last.content = `${block}\n\nUser request:\n${last.content}`;
      } else {
        messages.push({ role: "user", content: block } as ModelMessage);
      }
    }
    if (notices.length > 0) {
      messages.push({
        role: "system",
        content: `Context notes (tell the user briefly if relevant): ${notices.join("; ")}`,
      } as ModelMessage);
    }

    let model;
    try {
      model = resolveChatModel();
    } catch (err) {
      if (err instanceof NoLlmProviderError) {
        return Response.json({ error: err.message }, { status: 503 });
      }
      throw err;
    }

    const result = streamText({
      model,
      system: `${PROJECT_ASSISTANT_SYSTEM_PROMPT}\n\nCurrent project: "${project.name}"${project.description ? ` — ${project.description}` : ""}`,
      messages,
      tools: buildProjectTools(ctx),
      stopWhen: stepCountIs(8),
    });
    return result.toUIMessageStreamResponse();
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}
