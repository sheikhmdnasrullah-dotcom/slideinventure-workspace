import "server-only";

// Steel — hosted browser for the Browse agent. Optional: when STEEL_API_KEY is
// set, runBrowseTask uses Steel's managed Chromium instead of a local
// Playwright browser (better for headless CAPTCHA handling at scale).
export function steelEnabled(): boolean {
  return Boolean(process.env.STEEL_API_KEY);
}

export async function createSteelBrowser(): Promise<any | null> {
  if (!steelEnabled()) return null;
  try {
    const { SteelBrowser } = await import("steel-sdk");
    return await SteelBrowser.connect({ apiKey: process.env.STEEL_API_KEY as string });
  } catch {
    return null;
  }
}
