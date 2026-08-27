import "server-only";
import type { Browser, Page } from "playwright";

// Steel — hosted browser for the Browse agent. Optional: when STEEL_API_KEY is
// set, runBrowseTask uses Steel's managed Chromium instead of a local
// Playwright browser (better for headless CAPTCHA handling at scale).
export function steelEnabled(): boolean {
  return Boolean(process.env.STEEL_API_KEY);
}

export type SteelBrowserHandle = {
  page: () => Promise<Page>;
  close: () => Promise<void>;
};

export async function createSteelBrowser(): Promise<SteelBrowserHandle | null> {
  if (!steelEnabled()) return null;
  try {
    const [{ default: Steel }, { chromium }] = await Promise.all([
      import("steel-sdk"),
      import("playwright"),
    ]);
    const client = new Steel({ steelAPIKey: process.env.STEEL_API_KEY });
    const session = await client.sessions.create();
    // Steel exposes a CDP endpoint per session — connect Playwright to it
    // rather than launching a local browser.
    const browser: Browser = await chromium.connectOverCDP(session.websocketUrl);

    return {
      page: async () => {
        const context = browser.contexts()[0] ?? (await browser.newContext());
        return context.pages()[0] ?? (await context.newPage());
      },
      close: async () => {
        await browser.close().catch(() => {});
        await client.sessions.release(session.id).catch(() => {});
      },
    };
  } catch {
    return null;
  }
}
