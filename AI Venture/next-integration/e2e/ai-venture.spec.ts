import { test, expect } from "@playwright/test";

const EMAIL = process.env.AI_EMAIL || "";
const PASSWORD = process.env.AI_PASSWORD || "";

test.describe("AI Venture interactions", () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("requestfailed", (r) => {
      if (!r.url().includes("sentry") && !r.url().includes("dd-trace")) {
        errors.push(`request failed: ${r.url()} ${r.failure()?.errorText}`);
      }
    });
    (page as any)._errors = errors;
  });

  test("login and reach AI Venture", async ({ page }) => {
    if (!EMAIL || !PASSWORD) {
      test.skip(true, "AI_EMAIL / AI_PASSWORD not set");
      return;
    }

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    await page.fill('input[id="email"]', EMAIL);
    await page.fill('input[id="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    const url = new URL(page.url());
    expect(url.pathname).not.toBe("/login");

    await page.goto("/ai-venture", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);

    const errors: string[] = (page as any)._errors || [];
    expect(errors, `console/runtime errors: ${errors.join(" | ")}`).toEqual([]);

    await expect(page.locator("text=New file")).toBeVisible({ timeout: 5000 });
  });

  test("contextual add buttons in Brainstorm Sketches / Brainstormed Ideas", async ({ page }) => {
    if (!EMAIL || !PASSWORD) {
      test.skip(true, "AI_EMAIL / AI_PASSWORD not set");
      return;
    }

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    await page.fill('input[id="email"]', EMAIL);
    await page.fill('input[id="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    await page.goto("/ai-venture", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);

    const sketchBtn = page.locator('button:has-text("New sketch")');
    const ideaBtn = page.locator('button:has-text("New idea")');
    const fileBtn = page.locator('button:has-text("New file")');

    await expect(fileBtn).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /brainstorm sketches/i }).click();
    await page.waitForTimeout(600);
    await expect(sketchBtn).toBeVisible({ timeout: 5000 });

    const breadcrumb = page.getByRole("navigation", { name: /breadcrumb/i }).locator("a");
    if (await breadcrumb.count()) await breadcrumb.first().click();
    await page.waitForTimeout(400);

    await page.getByRole("button", { name: /brainstormed ideas/i }).click();
    await page.waitForTimeout(600);
    await expect(ideaBtn).toBeVisible({ timeout: 5000 });
  });

  test("rename dialog appears and submits", async ({ page }) => {
    if (!EMAIL || !PASSWORD) {
      test.skip(true, "AI_EMAIL / AI_PASSWORD not set");
      return;
    }

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    await page.fill('input[id="email"]', EMAIL);
    await page.fill('input[id="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    await page.goto("/ai-venture", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);

    const firstItem = page.locator('[data-slot="dropdown-menu-trigger"]').first();
    if (await firstItem.count()) {
      await firstItem.click();
      await page.waitForTimeout(200);
      await page.getByRole("menuitem", { name: /rename/i }).click();
      await page.waitForTimeout(200);
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 3000 });
      await page.fill('input[placeholder="notes"]', "renamed-folder-test");
      await page.click('button:has-text("Rename")');
      await page.waitForTimeout(400);
      const errors: string[] = (page as any)._errors || [];
      expect(errors, `errors after rename: ${errors.join(" | ")}`).toEqual([]);
    }
  });
});
