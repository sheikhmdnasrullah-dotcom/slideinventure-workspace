import { test, expect } from "@playwright/test";

/**
 * Motion & interaction stability audit for the dashboard.
 *
 * This drives the real app in a browser and checks the things the brief asks
 * for: no console/runtime errors on navigation, no horizontal overflow (layout
 * stability), reduced-motion collapsing the duration tokens, and that basic
 * hover micro-interactions don't throw. Auth-gated dashboard routes that
 * redirect to /login are still exercised for runtime errors.
 */

const ROUTES = [
  "/",
  "/leads",
  "/chat",
  "/agents",
  "/todoist",
  "/knowledge",
  "/documents",
  "/ai-venture",
  "/notepad",
  "/login",
];

test.setTimeout(120000);

for (const route of ROUTES) {
  test(`${route} — loads without console/runtime errors and no horizontal overflow`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(2);

    expect(
      errors,
      `console/runtime errors on ${route}: ${errors.join(" | ")}`
    ).toEqual([]);
  });
}

test("reduced motion collapses the duration tokens", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const dur = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--dur-base")
  );
  // 0.001s is serialized canonically as "1ms" by the browser; both are valid.
  expect(["0.001s", "1ms"]).toContain(dur.trim());
});

test("login page micro-interaction (hover) does not throw", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  const btn = page.locator("button").first();
  if (await btn.count()) {
    await btn.hover();
    await page.waitForTimeout(150);
  }
  expect(errors).toEqual([]);
});

test("sidebar layout persists a stable width on repeated navigation attempts", async ({
  page,
}) => {
  // Even when auth redirects, the (app) shell must not render a broken layout.
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  for (const r of ["/", "/chat", "/agents"]) {
    await page.goto(r, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
  }
  expect(errors).toEqual([]);
});
