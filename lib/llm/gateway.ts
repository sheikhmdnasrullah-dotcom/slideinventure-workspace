import "server-only";
import { langfuseGeneration } from "@/lib/observability/langfuse";
import { loadInfisicalSecrets } from "@/lib/vault/infisical";
import {
  availableProviders,
  modelFor,
  NVIDIA_DEFAULT_MODEL,
  OPENROUTER_DEFAULT_MODEL,
} from "@/lib/llm/models";

// Load secrets from Infisical into process.env once, at first LLM use.
loadInfisicalSecrets().catch(() => {});

export { NVIDIA_DEFAULT_MODEL, OPENROUTER_DEFAULT_MODEL };

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
// ingests the span). Reset on server restart, fine for a single-process VPS.
const usageStore = {
  total: { prompt: 0, completion: 0 },
  last: null as TokenUsage | null,
};
export function getTokenUsage() {
  return usageStore;
}

type Provider = { url: string; key: string; model: string };

// Provider order and credentials come from lib/llm/models so the raw-fetch
// gateway and the AI SDK routes can never disagree about which key belongs to
// which host.
//
// `opts.model` is applied per provider via modelFor(): previously a caller
// asking for an NVIDIA model name had that name forced onto DeepSeek and
// OpenRouter too, so every fallback in the chain was guaranteed to fail.
function buildProviders(opts: ChatOptions): Provider[] {
  return availableProviders().map((p) => ({
    url: p.baseURL,
    key: p.apiKey,
    model: modelFor(p, opts.model),
  }));
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
    signal: AbortSignal.timeout(15000),
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
  // Best-effort Langfuse trace (no-op when unconfigured).
  langfuseGeneration({
    name: "llm.generate",
    model: provider.model,
    input: messages,
    output: data.choices?.[0]?.message?.content ?? "",
    usage: { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens },
  }).catch(() => {});
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
