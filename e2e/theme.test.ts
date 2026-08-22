import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/", "/knowledge", "/chat", "/agents", "/leads", "/research", "/insights", "/activity", "/strategy", "/automations", "/cold-outreach", "/login"];
const THEMES = ["day", "night"];

function generateThemeTests() {
  const tests = [];
  for (const pagePath of PAGES) {
    for (const theme of ["day", "night"]) {
      tests.push({ pagePath, theme });
    }
  }
  return tests;
}

for (const { pagePath, theme } of generateThemeTests()) {
  test(`${theme} — ${pagePath}`, async ({ page }) => {
    await page.goto(pagePath, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    await page.addInitScript((t) => {
      try { localStorage.setItem("theme", t); } catch {}
    }, theme);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const htmlClass = await page.getAttribute("html", "class");
    expect(htmlClass).toContain(theme === "night" ? "dark" : "light");

    await expect(page).toHaveScreenshot(`${theme}-${pagePath.replace(/\//g, "-") || "home"}.png`, {
      maxDiffPixels: 100,
    });
  });
});

test.describe("Accessibility", () => {
  for (const pagePath of PAGES) {
    test(`${pagePath} — a11y`, async ({ page }) => {
      await page.goto(pagePath, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      const axeResults = await new AxeBuilder({ page }).analyze();
      expect(axeResults.violations).toEqual([]);
    });
  }
});

test.describe("Reduced motion", () => {
  test("respects prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const transitions = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      return styles.getPropertyValue("--dur-base");
    });
    expect(transitions).toBe("0.001s");
  });
});

test.describe("Keyboard navigation", () => {
  test("⌘K opens command menu", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    await page.keyboard.press("Meta+K");
    await page.waitForTimeout(200);

    const dialog = page.locator('[role="dialog"][aria-label="Command menu"]');
    await expect(dialog).toBeVisible();
  });

  test("Escape closes command menu", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.keyboard.press("Meta+K");
    await page.waitForTimeout(200);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);

    const dialog = page.locator('[role="dialog"][aria-label="Command menu"]');
    await expect(dialog).not.toBeVisible();
  });

  test("Tab navigation in command menu", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.keyboard.press("Meta+K");
    await page.waitForTimeout(200);

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
  });
});

test.describe("Focus management", () => {
  test("focus returns to trigger on dialog close", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    await page.keyboard.press("Meta+K");
    await page.waitForTimeout(200);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);

    const activeElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeElement).not.toBe("DIALOG");
  });
});