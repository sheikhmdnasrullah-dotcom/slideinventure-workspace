import "server-only";
import type { BaseChatModel } from "browser-use/llm/base";
import { primaryProvider, modelFor, type LlmProvider } from "@/lib/llm/models";

export function browserUseEnabled(): boolean {
  if (process.env.BROWSER_USE_ENABLED === "false") return false;
  return Boolean(
    process.env.BROWSER_USE_ENABLED === "true" ||
      process.env.BROWSER_USE_LLM_API_KEY ||
      primaryProvider()
  );
}

/**
 * Resolve the LLM browser-use should drive its actions with. An explicit
 * BROWSER_USE_LLM_API_KEY always wins (lets an operator point browsing at a
 * different/cheaper OpenRouter model than the main gateway). Otherwise this
 * reuses the exact same verified provider chain as lib/llm/models.ts instead
 * of independently guessing at a key — hardcoding browser-use to real
 * OpenRouter with whatever happened to be in OPENROUTER_API_KEY silently 401s
 * whenever that value is actually a DeepSeek/NVIDIA/LiteLLM key, which is
 * exactly the "key pointed at the wrong host" failure mode models.ts's own
 * availableProviders() was built to prevent everywhere else.
 */
async function resolveBrowserUseLlm(): Promise<BaseChatModel | null> {
  if (process.env.BROWSER_USE_LLM_API_KEY) {
    const { ChatOpenRouter } = await import("browser-use/llm/openrouter");
    return new ChatOpenRouter({
      apiKey: process.env.BROWSER_USE_LLM_API_KEY,
      model: process.env.BROWSER_USE_MODEL || "openai/gpt-4o",
    });
  }

  const provider = primaryProvider();
  if (!provider) return null;
  return llmForProvider(provider);
}

async function llmForProvider(provider: LlmProvider): Promise<BaseChatModel> {
  const model = modelFor(provider, process.env.BROWSER_USE_MODEL);
  if (provider.id === "deepseek") {
    const { ChatDeepSeek } = await import("browser-use/llm/deepseek");
    return new ChatDeepSeek({ apiKey: provider.apiKey, baseURL: provider.baseURL, model });
  }
  if (provider.id === "openrouter") {
    const { ChatOpenRouter } = await import("browser-use/llm/openrouter");
    return new ChatOpenRouter({ apiKey: provider.apiKey, baseURL: provider.baseURL, model });
  }
  // seekai / nvidia / litellm are OpenAI-compatible hosts with a custom baseURL.
  const { ChatOpenAI } = await import("browser-use/llm/openai");
  return new ChatOpenAI({ apiKey: provider.apiKey, baseURL: provider.baseURL, model });
}

export type BrowserUseTaskResult = {
  ok: boolean;
  backend: "browser-use";
  steps: { step: number; action: string; detail?: string }[];
  result: string;
  error?: string;
};

export async function runBrowserUseTask(
  task: string,
  opts: { userEmail?: string; maxSteps?: number } = {}
): Promise<BrowserUseTaskResult> {
  const steps: { step: number; action: string; detail?: string }[] = [];

  try {
    const llm = await resolveBrowserUseLlm();
    if (!llm) {
      return { ok: false, backend: "browser-use", steps, result: "", error: "no LLM provider configured" };
    }

    const { Agent } = await import("browser-use");
    const agent = new Agent({ task, llm });
    const history = await agent.run(opts.maxSteps ?? 20);

    // AgentHistoryList's per-step `result` is an ActionResult[], not a single
    // object. Reaching in as `.result.extracted_content` (an earlier version
    // of this code did) always misses and stringifies the whole list instead
    // ("[object Object]"). Use the library's own public accessors, which
    // already flatten this correctly: final_result() is sync (not a promise),
    // extracted_content()/action_names() are parallel per-step arrays.
    const actionNames = history.action_names();
    const extracted = history.extracted_content();
    actionNames.forEach((name, i) => {
      steps.push({ step: i + 1, action: name || "step", detail: extracted[i] ?? undefined });
    });

    let result = history.final_result() || "";
    if (!result) {
      // Prefer a step whose extracted content actually looks like an answer
      // (e.g. an email address, for the lead-harvest use case) over just the
      // last non-empty one, but fall back to the latter either way.
      result =
        [...extracted].reverse().find((c): c is string => c != null && c.includes("@")) ??
        [...extracted].reverse().find((c): c is string => c != null && c.length > 0) ??
        "";
    }

    // Only claim success when we have a real answer; otherwise the caller
    // falls through to the next browse backend instead of a dead end.
    const usable = result.trim().length > 0;
    return { ok: usable, backend: "browser-use", steps, result: usable ? result : "" };
  } catch (err) {
    return {
      ok: false,
      backend: "browser-use",
      steps,
      result: "",
      error: err instanceof Error ? err.message : "browser-use failed",
    };
  }
}
