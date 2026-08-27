import { streamText, type ModelMessage } from "ai";
import { NoLlmProviderError, providerSummary, resolveChatModel } from "@/lib/llm/models";

/**
 * Streaming chat for the AI SDK `useChat` surfaces (the /ai-chat page and the
 * floating copilot). Provider resolution is shared with every other AI route via
 * lib/llm/models, so there is one place that decides which key talks to which
 * host.
 */

// useChat (AI SDK v5) sends UIMessages with `parts`. Convert the text parts into
// ModelMessages directly (convertToModelMessages is unreliable in this ai@7
// build).
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

export async function POST(req: Request) {
  const { messages } = await req.json();

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
    messages: toModelMessages(Array.isArray(messages) ? messages : []),
  });
  return result.toUIMessageStreamResponse();
}

/** Lets the UI show which provider is actually answering, without guessing. */
export async function GET() {
  return Response.json(providerSummary());
}
