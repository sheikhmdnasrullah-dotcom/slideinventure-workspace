import "server-only";
import type { Browser, Page } from "playwright";
import { chatCompletion } from "@/lib/llm/gateway";
import { solveCaptcha, isCaptchaSolvingEnabled } from "@/lib/integrations/captcha";
import { logActivity } from "@/lib/activities/client";
import { createSteelBrowser, steelEnabled } from "@/lib/browse/steel";

export type BrowseStep = {
  step: number;
  action: string;
  detail?: string;
  observation?: string;
};

export type BrowseResult = {
  ok: boolean;
  steps: BrowseStep[];
  result: string;
  // Real text observed on each visited page (used for faithful extraction,
  // so the caller never has to trust the LLM's free-form answer).
  pagesText?: string[];
  error?: string;
};

const ACTION_SYSTEM = `You are a web-browsing agent. Given a task and the current page state, decide the NEXT single action.
Respond with ONLY a JSON object, no markdown, one of:
{"action":"extract"}: read the page and extract information relevant to the task
{"action":"goto","url":"<full url>"}: navigate to a URL
{"action":"click","selector":"<css selector>"}: click an element
{"action":"type","selector":"<css selector>","text":"<text>"}: type into a field
{"action":"submit","selector":"<form css selector>"}: submit a form
{"action":"done","answer":"<final answer to the task>"}: finish
Keep selectors simple. Prefer links/buttons by visible text via :has-text().`;

async function llmAction(task: string, pageState: string): Promise<any> {
  const prompt = `TASK: ${task}\n\nCURRENT PAGE STATE:\n${pageState}\n\nChoose the next action.`;
  // chatCompletion returns the completion text directly (no OpenAI-style
  // `.choices[0].message.content` wrapper, and no `json` mode option). The
  // ACTION_SYSTEM prompt already instructs JSON-only output.
  const text = (
    await chatCompletion(
      [
        { role: "system", content: ACTION_SYSTEM },
        { role: "user", content: prompt },
      ],
      { temperature: 0.2 }
    )
  ).trim();
  try {
    return JSON.parse(text.replace(/^```json|^```|```$/g, "").trim());
  } catch {
    return { action: "extract" };
  }
}

async function detectCaptcha(page: Page): Promise<{ siteKey: string | null; pageUrl: string } | null> {
  const found = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".g-recaptcha, [data-sitekey]");
    const siteKey = el?.getAttribute("data-sitekey") || null;
    const frame = Array.from(document.querySelectorAll("iframe")).find((f) =>
      (f.src || "").includes("recaptcha") || (f.src || "").includes("hcaptcha")
    );
    const url = frame?.src || "";
    const m = url.match(/[?&](?:k|sitekey)=([\w-]+)/);
    return { siteKey: siteKey || (m ? m[1] : null), pageUrl: location.href };
  });
  return found.siteKey ? found : null;
}

async function solveOnPage(page: Page): Promise<boolean> {
  if (!isCaptchaSolvingEnabled()) return false;
  const cap = await detectCaptcha(page);
  if (!cap || !cap.siteKey) return false;
  const solved = await solveCaptcha({ siteKey: cap.siteKey, pageUrl: cap.pageUrl });
  if (!solved.ok || !solved.token) return false;
  await page.evaluate((token: string) => {
    const ta = document.getElementById("g-recaptcha-response") as HTMLTextAreaElement | null;
    if (ta) {
      ta.value = token;
      ta.style.display = "block";
      ta.style.visibility = "visible";
    }
    const w = window as any;
    if (typeof w.___captchaCallback === "function") w.___captchaCallback(token);
  }, solved.token);
  return true;
}

function summarizePage(page: Page, content: string): string {
  const url = page.url();
  const title = page.title();
  const clipped = content.replace(/\s+/g, " ").trim().slice(0, 4000);
  return `URL: ${url}\nTITLE: ${title}\nCONTENT:\n${clipped}`;
}

export async function runBrowseTask(opts: {
  task: string;
  startUrl?: string;
  maxSteps?: number;
  userEmail?: string;
}): Promise<BrowseResult> {
  const maxSteps = opts.maxSteps ?? 5;

  // Preferred backends (when enabled): graceful fallthrough to the local
  // Playwright agent below if any of them fail.
  if (opts.task) {
    try {
      const sh = await import("@/lib/browse/stagehand");
      if (sh.stagehandEnabled()) {
        const r = await sh.runStagehandTask(opts.task, opts.startUrl, {
          userEmail: opts.userEmail,
          maxSteps,
        });
        if (r.ok) return { ok: true, steps: r.steps as any, result: r.result };
      }
    } catch {}
    try {
      const bu = await import("@/lib/browse/browseruse");
      if (bu.browserUseEnabled()) {
        const r = await bu.runBrowserUseTask(opts.task, {
          userEmail: opts.userEmail,
          maxSteps,
        });
        if (r.ok) return { ok: true, steps: r.steps as any, result: r.result };
      }
    } catch {}
  }

  const steps: BrowseStep[] = [];
  const pagesText: string[] = [];
  let browser: Browser | null = null;
  let steel: any = null;
  let page: Page;

  try {
    // Prefer Steel's managed browser when configured (better headless CAPTCHA
    // handling); otherwise fall back to a local Playwright Chromium.
    if (steelEnabled()) {
      steel = await createSteelBrowser();
    }
    if (steel) {
      page = await steel.page();
    } else {
      const { chromium } = await import("playwright");
      browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      });
      page = await context.newPage();
    }
    // Initial navigation. Heavy sites (YouTube, etc.) can exceed 30s under
    // headless; give it more time, and if it still fails, fall back to a web
    // search derived from the task so the agent can still make progress.
    const startUrl = opts.startUrl || "https://www.google.com";
    try {
      await page.goto(startUrl, { timeout: 60000, waitUntil: "domcontentloaded" });
    } catch {
      try {
        await page.goto(
          `https://www.google.com/search?q=${encodeURIComponent(opts.task.slice(0, 200))}`,
          { timeout: 30000, waitUntil: "domcontentloaded" }
        );
      } catch {
        // last resort: blank page; the agent loop will decide next actions
      }
    }

    let finalAnswer = "";

    for (let i = 1; i <= maxSteps; i++) {
      const captchaSolved = await solveOnPage(page);
      const content = await page.evaluate(
        () => (document.body ? document.body.innerText : document.documentElement ? document.documentElement.innerText : "")
      );
      pagesText.push(content);
      const state = summarizePage(page, content);

      const action = await llmAction(opts.task, state + (captchaSolved ? "\n[CAPTCHA was solved; continue.]" : ""));
      steps.push({ step: i, action: action.action, detail: action.url || action.selector || action.text || undefined });

      if (action.action === "done") {
        finalAnswer = action.answer || "";
        break;
      } else {
        try {
          if (action.action === "goto") {
            await page.goto(action.url, { timeout: 30000, waitUntil: "domcontentloaded" });
          } else if (action.action === "click") {
            await page.click(action.selector, { timeout: 10000 }).catch(() => {});
          } else if (action.action === "type") {
            await page.fill(action.selector, action.text || "", { timeout: 10000 }).catch(() => {});
          } else if (action.action === "submit") {
            await page.evaluate((sel: string) => {
              const form = document.querySelector(sel) as HTMLFormElement | null;
              form?.requestSubmit?.();
            }, action.selector).catch(() => {});
          } else {
            steps[steps.length - 1].observation = content.slice(0, 500);
          }
        } catch {
          // a single failed action shouldn't abort the whole task
          steps[steps.length - 1].observation = "action failed";
        }
      }
      await page.waitForTimeout(800);
    }

    if (!finalAnswer) {
      const content = await page.evaluate(
        () => (document.body ? document.body.innerText : document.documentElement ? document.documentElement.innerText : "")
      );
      pagesText.push(content);
      finalAnswer = (
        await chatCompletion([
          { role: "system", content: "Answer the task using the page content. Be concise." },
          { role: "user", content: `TASK: ${opts.task}\n\nPAGE:\n${content.slice(0, 5000)}` },
        ], { temperature: 0.3 })
      ) || "(no answer)";
    }

    // logActivity derives the user from the current request's session itself
    // (it doesn't take a userEmail param), safe to call unconditionally.
    await logActivity({
      category: "agents",
      action: "executed",
      title: "Browse agent task",
      description: opts.task,
      metadata: { steps: steps.length, startUrl: opts.startUrl },
    }).catch(() => {});

    return { ok: true, steps, result: finalAnswer, pagesText };
  } catch (err) {
    return { ok: false, steps, result: "", error: err instanceof Error ? err.message : "browse failed" };
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (steel) await steel.close?.().catch(() => {});
  }
}
