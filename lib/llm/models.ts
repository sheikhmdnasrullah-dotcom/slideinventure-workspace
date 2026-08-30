import "server-only";
import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { loadInfisicalSecrets } from "@/lib/vault/infisical";

loadInfisicalSecrets().catch(() => {});

/**
 * Single source of truth for which OpenAI-compatible provider the AI SDK talks
 * to. Before this existed, `/api/ai-chat`, `/api/agents/chat` and
 * `/api/copilot` each did:
 *
 *   createOpenAI({ apiKey: DEEPSEEK_API_KEY ?? OPENROUTER_API_KEY,
 *                  baseURL: "https://api.deepseek.com/v1" })
 *
 * which sends an OpenRouter key to DeepSeek's host whenever DeepSeek isn't
 * configured. That "fallback" could only ever 401. Here every provider carries
 * its own baseURL, so a key is never pointed at the wrong host.
 */

export type LlmProviderId =
  | "seekai"
  | "litellm"
  | "deepseek"
  | "nvidia"
  | "openrouter";

/**
 * Build a provider only when BOTH its key and its OpenAI-compatible base URL
 * are present. The three user-supplied gateways (SeekAI/GoRouter/TabiAi) have
 * no hard-coded host — their base URL is provided at deploy time via env, so a
 * missing base URL simply skips that provider instead of pointing the key at a
 * wrong host.
 */
function gatewayProvider(opts: {
  id: "seekai";
  keyEnv: string;
  urlEnv: string;
  modelEnv: string;
}): LlmProvider | null {
  const apiKey = process.env[opts.keyEnv];
  const baseURL = process.env[opts.urlEnv];
  if (!apiKey || !baseURL) return null;
  return {
    id: opts.id,
    baseURL: baseURL.replace(/\/$/, ""),
    apiKey,
    defaultModel: process.env[opts.modelEnv] ?? "gpt-4o",
  };
}

export type LlmProvider = {
  id: LlmProviderId;
  baseURL: string;
  apiKey: string;
  defaultModel: string;
};

// nemotron-3-ultra-550b-a55b is listed in NVIDIA's /v1/models catalog but its
// serving function 404s (nvcf-status: errored) — verified dead against the
// live account, not a guess. nemotron-3-super-120b-a12b is confirmed working
// against the same key.
export const NVIDIA_DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b";
export const OPENROUTER_DEFAULT_MODEL =
  process.env.OPENROUTER_FALLBACK_MODEL || "openai/gpt-oss-120b";

/**
 * Ordered by preference (user-specified):
 *   1. SeekAI      (user-supplied gateway, verified working)
 *   2. DeepSeek    3. NVIDIA    (direct keys)
 *   4. LiteLLM     5. OpenRouter (routers / extra fallbacks)
 *
 * GoRouter and TabiAi were removed from the chain: both are behind a Cloudflare
 * managed-challenge (HTTP 403) that blocks server-to-server API calls, so they
 * cannot be reached. Re-add here (plus their env vars) once that is resolved.
 */
export function availableProviders(): LlmProvider[] {
  const out: LlmProvider[] = [];

  const seekai = gatewayProvider({
    id: "seekai",
    keyEnv: "SEEKAI_API_KEY",
    urlEnv: "SEEKAI_BASE_URL",
    modelEnv: "SEEKAI_MODEL",
  });
  if (seekai) out.push(seekai);

  if (process.env.DEEPSEEK_API_KEY) {
    out.push({
      id: "deepseek",
      baseURL: "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY,
      defaultModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    });
  }

  if (process.env.NVIDIA_API_KEY) {
    out.push({
      id: "nvidia",
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey: process.env.NVIDIA_API_KEY,
      defaultModel: NVIDIA_DEFAULT_MODEL,
    });
  }

  const litellmUrl = process.env.LITELLM_BASE_URL;
  const litellmKey = process.env.LITELLM_API_KEY;
  if (litellmUrl && litellmKey) {
    out.push({
      id: "litellm",
      baseURL: litellmUrl.replace(/\/$/, ""),
      apiKey: litellmKey,
      defaultModel: process.env.LITELLM_MODEL ?? "deepseek-chat",
    });
  }

  if (process.env.OPENROUTER_API_KEY) {
    out.push({
      id: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultModel: OPENROUTER_DEFAULT_MODEL,
    });
  }

  return out;
}

export function primaryProvider(): LlmProvider | null {
  return availableProviders()[0] ?? null;
}

const clientCache = new Map<string, OpenAIProvider>();

export function providerClient(provider: LlmProvider): OpenAIProvider {
  const cached = clientCache.get(provider.id);
  if (cached) return cached;
  const client = createOpenAI({
    name: provider.id,
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
  });
  clientCache.set(provider.id, client);
  return client;
}

export class NoLlmProviderError extends Error {
  constructor() {
    super(
      "No AI provider configured. Set one of SEEKAI_BASE_URL + SEEKAI_API_KEY, DEEPSEEK_API_KEY, NVIDIA_API_KEY, LITELLM_BASE_URL + LITELLM_API_KEY, or OPENROUTER_API_KEY."
    );
    this.name = "NoLlmProviderError";
  }
}

/**
 * Resolve a LanguageModel for the AI SDK (`streamText`, `generateText`).
 * `model` is only applied when it is meaningful for the resolved provider, so
 * asking for an NVIDIA model name never gets forwarded to DeepSeek.
 */
export function resolveChatModel(opts: { model?: string } = {}): LanguageModel {
  const provider = primaryProvider();
  if (!provider) throw new NoLlmProviderError();
  const client = providerClient(provider);
  return client(modelFor(provider, opts.model));
}

/**
 * A requested model name is honoured only when it plausibly belongs to the
 * provider we resolved to (or when that provider is a router that accepts any
 * upstream name). Otherwise the provider's own default is used.
 */
export function modelFor(provider: LlmProvider, requested?: string): string {
  if (!requested) return provider.defaultModel;
  // Routers accept arbitrary upstream model names as-is.
  if (
    provider.id === "litellm" ||
    provider.id === "openrouter" ||
    provider.id === "seekai"
  ) {
    return requested;
  }
  if (provider.id === "nvidia" && requested.includes("/")) return requested;
  if (provider.id === "deepseek" && requested.startsWith("deepseek")) return requested;
  return provider.defaultModel;
}

/** Non-secret provider summary for diagnostics and the settings surface. */
export function providerSummary() {
  const providers = availableProviders();
  return {
    active: providers[0]?.id ?? null,
    model: providers[0] ? modelFor(providers[0]) : null,
    fallbacks: providers.slice(1).map((p) => p.id),
    configured: providers.length > 0,
  };
}
