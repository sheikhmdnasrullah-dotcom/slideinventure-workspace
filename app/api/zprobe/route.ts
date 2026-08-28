import { availableProviders } from "@/lib/llm/models";

export const dynamic = "force-dynamic";

export async function GET() {
  const providers = availableProviders();
  const results: Record<string, unknown>[] = [];
  for (const p of providers) {
    const chat = await fetch(`${p.baseURL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: p.defaultModel,
        messages: [{ role: "user", content: "Reply with the single word: OK" }],
        max_tokens: 5,
        stream: false,
      }),
    })
      .then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 240) }))
      .catch((e: unknown) => ({ status: "ERR", body: String((e as Error)?.message ?? e).slice(0, 240) }));

    let models = "skipped";
    try {
      const mr = await fetch(`${p.baseURL}/models`, { headers: { Authorization: `Bearer ${p.apiKey}` } });
      models = (await mr.text()).slice(0, 500);
    } catch {
      models = "fetch-failed";
    }

    results.push({ id: p.id, baseURL: p.baseURL, defaultModel: p.defaultModel, chat, models });
  }
  return Response.json({ priority: providers.map((p) => p.id), results });
}
