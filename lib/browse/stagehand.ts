import "server-only";
import { chatCompletion } from "@/lib/llm/gateway";

export function stagehandEnabled(): boolean {
  if (process.env.STAGEHAND_ENABLED === "false") return false;
  // Default ON: route Stagehand's LLM through our gateway (NVIDIA/OpenRouter).
  return Boolean(
    process.env.STAGEHAND_ENABLED === "true" ||
      process.env.NVIDIA_API_KEY ||
      process.env.OPENROUTER_API_KEY ||
      process.env.STAGEHAND_MODEL_API_KEY ||
      (process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID)
  );
}

export type StagehandTaskResult = {
  ok: boolean;
  backend: "stagehand";
  steps: { step: number; action: string; detail?: string }[];
  result: string;
  error?: string;
};

// Stagehand's custom model client: delegate every LLM call to our unified gateway.
// Returns an OpenAI-compatible chat completion so Stagehand can parse actions/extractions.
function gatewayModel() {
  return {
    generate: async ({ messages }: { messages: any[] }) => {
      const normalized = (messages || []).map((m: any) => ({
        role: m.role,
        content:
          typeof m.content === "string"
            ? m.content
            : Array.isArray(m.content)
              ? m.content.map((c: any) => (c?.text ?? c?.content ?? "")).join("")
              : "",
      }));
      const resp = await chatCompletion(normalized, { temperature: 0 });
      return {
        id: "stagehand-gateway",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "gateway",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: resp.text || "" },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: resp.usage?.promptTokens ?? 0,
          completion_tokens: resp.usage?.completionTokens ?? 0,
          total_tokens: (resp.usage?.promptTokens ?? 0) + (resp.usage?.completionTokens ?? 0),
        },
      };
    },
  };
}

export async function runStagehandTask(
  task: string,
  startUrl?: string,
  opts: { userEmail?: string; maxSteps?: number } = {}
): Promise<StagehandTaskResult> {
  const steps: { step: number; action: string; detail?: string }[] = [];
  let stagehand: any = null;
  let browser: any = null;

  try {
    const { Stagehand, localBrowser, browserbase } = await import("@browserbasehq/stagehand");

    if (process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID) {
      browser = await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY,
        projectId: process.env.BROWSERBASE_PROJECT_ID,
      });
    } else {
      browser = await localBrowser.launch({ headless: true, args: ["--no-sandbox"] });
    }

    stagehand = await Stagehand.create({ browser, model: gatewayModel() });
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
      if (judge.text?.trim().toUpperCase().startsWith("DONE")) break;
    }

    const content: string = await page.evaluate(() => document.body.innerText).catch(() => "");
    const final = await chatCompletion(
      [
        { role: "system", content: "Answer the task using the page content. Be concise." },
        { role: "user", content: `TASK: ${task}\n\nPAGE:\n${content.slice(0, 5000)}` },
      ],
      { temperature: 0.3 }
    );

    return { ok: true, backend: "stagehand", steps, result: final.text || "" };
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
