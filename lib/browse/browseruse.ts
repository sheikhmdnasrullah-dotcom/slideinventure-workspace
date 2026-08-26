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
    const history: any = await agent.run(opts.maxSteps ?? 20);

    // Best-effort extraction of the final answer from the history list.
    let result = "";
    try {
      result = (await history.final_result?.()) || "";
    } catch {}
    if (!result && Array.isArray(history?.history)) {
      const last = history.history[history.history.length - 1];
      result = last?.result?.extracted_content || last?.result?.long_term_memory || "";
    }
    if (!result) result = String(history ?? "");

    if (Array.isArray(history?.history)) {
      history.history.forEach((h: any, i: number) => {
        steps.push({
          step: i + 1,
          action: h?.result?.action?.type ?? "step",
          detail: h?.result?.extracted_content ?? undefined,
        });
      });
    }

    return { ok: true, backend: "browser-use", steps, result: result || "(no result)" };
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
