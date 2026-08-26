import "server-only";

export const NVIDIA_DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
// Cheap OpenRouter fallback used only when NVIDIA is unavailable. Override with
// OPENROUTER_FALLBACK_MODEL if you prefer a different model. NVIDIA stays primary.
export const OPENROUTER_DEFAULT_MODEL =
  process.env.OPENROUTER_FALLBACK_MODEL || "openai/gpt-oss-120b";

export type ChatMessage = { role: string; content: string };
export type ChatOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  fallbackModel?: string;
};

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  model: string;
};

// In-memory token accounting for visible cost/token tracking (Datadog also
// ingests the span). Reset on server restart — fine for a single-process VPS.
const usageStore = {
  total: { prompt: 0, completion: 0 },
  last: null as TokenUsage | null,
};
export function getTokenUsage() {
  return usageStore;
}

type Provider = { url: string; key: string; model: string };

function buildProviders(opts: ChatOptions): Provider[] {
  const providers: Provider[] = [];
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (nvidiaKey) {
    providers.push({
      url: "https://integrate.api.nvidia.com/v1",
      key: nvidiaKey,
      model: opts.model ?? NVIDIA_DEFAULT_MODEL,
    });
  }
  if (openrouterKey) {
    providers.push({
      url: "https://openrouter.ai/api/v1",
      key: openrouterKey,
      model: opts.model ?? opts.fallbackModel ?? OPENROUTER_DEFAULT_MODEL,
    });
  }
  return providers;
}

async function completeAt(
  provider: Provider,
  messages: ChatMessage[],
  opts: ChatOptions
): Promise<{ text: string; usage: TokenUsage }> {
  const res = await fetch(`${provider.url}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 2048,
      stream: false,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM ${provider.url} failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const usage: TokenUsage = {
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
    model: provider.model,
  };
  return { text: data.choices?.[0]?.message?.content ?? "", usage };
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts: ChatOptions = {}
): Promise<string> {
  const providers = buildProviders(opts);
  if (providers.length === 0) {
    throw new Error(
      "No LLM provider configured (set NVIDIA_API_KEY and/or OPENROUTER_API_KEY)"
    );
  }

  let lastErr: unknown;
  for (const provider of providers) {
    // up to 2 attempts per provider (initial + 1 retry)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { text, usage } = await completeAt(provider, messages, opts);
        usageStore.total.prompt += usage.promptTokens;
        usageStore.total.completion += usage.completionTokens;
        usageStore.last = usage;
        traceLLM(usage);
        return text;
      } catch (e) {
        lastErr = e;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("LLM completion failed");
}

// Best-effort Datadog APM span for token visibility. Never throws.
function traceLLM(usage: TokenUsage) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tracer = require("dd-trace");
    if (tracer && typeof tracer.tracer?.startSpan === "function") {
      const span = tracer.tracer.startSpan("llm.chat.completion");
      span.setTag("model", usage.model);
      span.setTag("ai.token_count.prompt", usage.promptTokens);
      span.setTag("ai.token_count.completion", usage.completionTokens);
      span.finish();
    }
  } catch {
    /* no-op */
  }
}
