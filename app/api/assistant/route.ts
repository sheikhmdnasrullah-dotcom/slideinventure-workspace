import { streamText } from "ai";
import { NoLlmProviderError, resolveChatModel } from "@/lib/llm/models";
import { tavilySearch } from "@/lib/search/tavily";

/**
 * Streaming assistant for the floating chat widget. Uses the same provider
 * resolution as every other AI route (DeepSeek when configured), and augments
 * the prompt with a live Tavily web search so the assistant can answer general
 * and realtime questions, not just what's stored in the workspace.
 *
 * Streams a minimal SSE protocol the client parses directly:
 *   data: {"type":"delta","content":"..."}
 *   data: {"type":"done"}
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

  // Best-effort web context. Kept out of the streamed path so it never blocks
  // the first token.
  const webHits = query ? await tavilySearch(query, { maxResults: 5 }).catch(() => []) : [];

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

  const systemPrompt = `You are the SlideIn Venture OS assistant, available from a floating chat widget on every page. You can answer questions about the workspace and about general or realtime topics using web search results provided below. Be concise and helpful. Cite sources by URL when you use web results.${webContext}`;

  const llmMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages
      .filter((m) => m.content)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content as string,
      })),
  ];

  const result = streamText({ model, messages: llmMessages, temperature: 0.3 });

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
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "delta", content: "\n\n[assistant error]" })}\n\n`
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
