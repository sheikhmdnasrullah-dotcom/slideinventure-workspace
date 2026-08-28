import { streamText } from "ai";
import { NoLlmProviderError, resolveChatModel } from "@/lib/llm/models";
import { tavilySearch } from "@/lib/search/tavily";
import { getSessionUser } from "@/lib/appwrite/auth";
import {
  getConsolidatedMemoryContext,
  detectAndProcessMemoryIntent,
} from "@/lib/memory/obsidian-memory";

/**
 * Streaming assistant for the floating chat widget.
 * Features:
 * - Persistent memory stored in Obsidian (SecondBrain/Dashboard/Memory.md and SecondBrain/Memory/)
 * - Automatic memory intent detection & persistence across conversations
 * - Realtime web search augmentation via Tavily
 * - Multi-provider LLM resolution (DeepSeek / LiteLLM / NVIDIA / OpenRouter)
 */

interface IncomingMessage {
  role?: string;
  content?: string;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages: IncomingMessage[] = incoming.filter(
    (m: IncomingMessage) => m.role === "user" || m.role === "assistant"
  );

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const query = lastUser?.content?.trim() ?? "";

  const user = await getSessionUser().catch(() => null);
  const userEmail = user?.email;

  let model;
  try {
    model = resolveChatModel();
  } catch (err) {
    if (err instanceof NoLlmProviderError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }

  const encoder = new TextEncoder();

  // 1. Check if user wants to save something to persistent memory
  let memoryNotice = "";
  if (query) {
    const memoryAction = await detectAndProcessMemoryIntent(query, userEmail).catch(() => ({
      detected: false as const,
      saved: false as const,
    }));
    if (memoryAction.saved && "fact" in memoryAction && memoryAction.fact) {
      memoryNotice = `\n\n[SYSTEM NOTIFICATION]: The user requested to save knowledge/memory. The fact "${memoryAction.fact}" has been successfully saved permanently to the Obsidian vault (SecondBrain/Dashboard/Memory.md and SecondBrain/Memory/). Inform the user that it is now saved in persistent memory, and strictly obey any styling/formatting constraints specified in their prompt.`;
    }
  }

  // 2. Fetch persistent memory context and web search results in parallel
  const [memoryContext, webHits] = await Promise.all([
    getConsolidatedMemoryContext({ userEmail, query }).catch(() => ""),
    query ? tavilySearch(query, { maxResults: 5 }).catch(() => []) : [],
  ]);

  const webContext =
    webHits.length > 0
      ? "\n\nWeb search results (use these for current/realtime info, cite URLs):\n" +
        webHits
          .map(
            (h, i) =>
              `[web ${i + 1}] ${h.title} — ${h.url}\n${h.content}`
          )
          .join("\n\n")
      : "";

  const systemPrompt = `You are the SlideIn Venture OS assistant, available from a floating chat widget and across the workspace.
You have persistent long-term memory across sessions. Your memory is stored in the workspace's Obsidian vault and Dashboard folder (SecondBrain/Dashboard/Memory.md).
You can remember user preferences, stored knowledge, and facts between conversations.
When answering, use your persistent memory, workspace data, and live web search results.
Be helpful, concise, and accurate. Follow user formatting constraints strictly.${memoryContext}${webContext}${memoryNotice}`;

  const llmMessages = messages
    .filter((m) => m.content)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    }));

  const result = streamText({ model, system: systemPrompt, messages: llmMessages, temperature: 0.3 });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of result.textStream) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`)
          );
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "delta", content: `\n\n[assistant error: ${msg}]` })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
