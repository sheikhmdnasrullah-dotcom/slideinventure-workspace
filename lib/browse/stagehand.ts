import "server-only";
import { chatCompletion } from "@/lib/llm/gateway";

// Stagehand's `model` option only accepts one of its own supported
// provider/model-name strings (openai/anthropic/google/groq/cerebras) plus
// that provider's own API key. It has no support for an arbitrary custom
// model client, so our NVIDIA/OpenRouter gateway can't be plugged in here.
// Browserbase credentials alone (hosted browser) aren't enough either:
// Stagehand's AI reasoning still needs one of the model keys below.
function supportedModel() {
  if (process.env.OPENAI_API_KEY) return { modelName: "openai/gpt-4o-mini" as const, apiKey: process.env.OPENAI_API_KEY };
  if (process.env.ANTHROPIC_API_KEY) return { modelName: "anthropic/claude-haiku-4-5" as const, apiKey: process.env.ANTHROPIC_API_KEY };
  if (process.env.GOOGLE_API_KEY) return { modelName: "google/gemini-2.0-flash" as const, apiKey: process.env.GOOGLE_API_KEY };
  if (process.env.GROQ_API_KEY) return { modelName: "groq/llama-3.3-70b-versatile" as const, apiKey: process.env.GROQ_API_KEY };
  if (process.env.CEREBRAS_API_KEY) return { modelName: "cerebras/gpt-oss-120b" as const, apiKey: process.env.CEREBRAS_API_KEY };
  return null;
}

export function stagehandEnabled(): boolean {
  if (process.env.STAGEHAND_ENABLED === "false") return false;
  return supportedModel() !== null;
}

export type StagehandTaskResult = {
  ok: boolean;
  backend: "stagehand";
  steps: { step: number; action: string; detail?: string }[];
  result: string;
  error?: string;
};

export async function runStagehandTask(
  task: string,
  startUrl?: string,
  opts: { userEmail?: string; maxSteps?: number } = {}
): Promise<StagehandTaskResult> {
  const steps: { step: number; action: string; detail?: string }[] = [];
  let stagehand: any = null;
  let browser: any = null;

  try {
    const model = supportedModel();
    if (!model) throw new Error("no supported Stagehand model API key configured");

    const { Stagehand, localBrowser, browserbase } = await import("@browserbasehq/stagehand");

    if (process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID) {
      browser = await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY,
        projectId: process.env.BROWSERBASE_PROJECT_ID,
      });
    } else {
      browser = await localBrowser.launch({ headless: true, args: ["--no-sandbox"] });
    }

    stagehand = await Stagehand.create({
      browser,
      model: { modelName: model.modelName, apiKey: model.apiKey },
    });
    const pages = await browser.context.pages();
    const page = pages[0];
    await page.goto(startUrl || "https://www.google.com", {
      timeout: 30000,
      waitUntil: "domcontentloaded",
    });

    const maxSteps = opts.maxSteps ?? 12;
    for (let i = 1; i <= maxSteps; i++) {
      const act = await stagehand
        .act(`Perform the next single action toward this task: ${task}`)
        .catch(() => null);
      steps.push({ step: i, action: "stagehand.act", detail: act?.action ?? undefined });

      const content: string = await page.evaluate(() => document.body.innerText).catch(() => "");
      const judge = await chatCompletion(
        [
          {
            role: "system",
            content:
              "Reply with exactly 'DONE' if the current page satisfies the task, otherwise 'CONTINUE'.",
          },
          { role: "user", content: `TASK: ${task}\n\nPAGE:\n${content.slice(0, 4000)}` },
        ],
        { temperature: 0 }
      );
      if (judge.trim().toUpperCase().startsWith("DONE")) break;
    }

    const content: string = await page.evaluate(() => document.body.innerText).catch(() => "");
    const final = await chatCompletion(
      [
        { role: "system", content: "Answer the task using the page content. Be concise." },
        { role: "user", content: `TASK: ${task}\n\nPAGE:\n${content.slice(0, 5000)}` },
      ],
      { temperature: 0.3 }
    );

    return { ok: true, backend: "stagehand", steps, result: final || "" };
  } catch (err) {
    return {
      ok: false,
      backend: "stagehand",
      steps,
      result: "",
      error: err instanceof Error ? err.message : "stagehand failed",
    };
  } finally {
    try {
      await stagehand?.close();
    } catch {}
    try {
      await browser?.close?.();
    } catch {}
  }
}
