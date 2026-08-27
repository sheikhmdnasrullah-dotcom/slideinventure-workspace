import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY ?? process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://api.deepseek.com/v1",
});

// useChat (Vercel AI SDK v5) sends UIMessages with `parts`. Convert the text
// parts into ModelMessages directly (convertToModelMessages is unreliable in
// this ai@7 build).
function toModelMessages(messages: any[]) {
  return messages.map((m) => ({
    role: m.role,
    content: Array.isArray(m.parts)
      ? m.parts
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .join("")
      : typeof m.content === "string"
        ? m.content
        : "",
  }));
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: deepseek("deepseek-chat"),
    messages: toModelMessages(Array.isArray(messages) ? messages : []),
  });
  return result.toUIMessageStreamResponse();
}
