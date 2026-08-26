import { test, expect } from "@playwright/test";

test.describe("AI Venture smoke (no-auth)", () => {
  test("loads /ai-venture without runtime errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto("/ai-venture", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(2);
    expect(errors, `console/runtime errors: ${errors.join(" | ")}`).toEqual([]);
  });
});
