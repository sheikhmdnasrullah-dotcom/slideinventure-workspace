import "server-only";

// Thin DeepSeek wrapper used to power the three research agents the user asked
// to integrate (MiroThinker / Open Deep Research / DeepResearchAgent). These run
// as DeepSeek-backed research personas in a coordinated tick loop.
export type DeepSeekMessage = { role: "system" | "user" | "assistant"; content: string };

export async function deepseekChat(
  messages: DeepSeekMessage[],
  opts: { temperature?: number; maxTokens?: number; model?: string } = {}
): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not configured");
  const model = opts.model || process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 1800,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DeepSeek failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}
