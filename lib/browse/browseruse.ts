import "server-only";

export function browserUseEnabled(): boolean {
  if (process.env.BROWSER_USE_ENABLED === "false") return false;
  // Default ON when an OpenRouter-compatible key is available.
  return Boolean(
    process.env.BROWSER_USE_ENABLED === "true" ||
      process.env.OPENROUTER_API_KEY ||
      process.env.BROWSER_USE_LLM_API_KEY
  );
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
    const { Agent } = await import("browser-use");
    const { ChatOpenRouter } = await import("browser-use/llm/openrouter");

    const apiKey = process.env.BROWSER_USE_LLM_API_KEY || process.env.OPENROUTER_API_KEY || "";
    const model = process.env.BROWSER_USE_MODEL || "openai/gpt-4o";

    const llm = new ChatOpenRouter({ model, apiKey });
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
