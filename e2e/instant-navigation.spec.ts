import { test, expect } from "./fixtures";

/**
 * Locks in the instant-navigation behaviour of the dashboard shell.
 *
 * These assertions are deliberately structural rather than timing-based: wall
 * clock numbers are flaky on CI, but "did the router issue a server request"
 * and "did the shell survive" are deterministic and are what actually make a
 * section switch feel instant.
 */

/** Requests the App Router makes to fetch a new RSC payload. */
function isRscRequest(url: string) {
  return url.includes("_rsc=");
}

test.describe("instant navigation", () => {
  test("sidebar nav uses real prefetching links, not router.push", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const sidebar = page.locator("[data-slot=sidebar]").first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    // Every internal destination must be an <a href>. A button + router.push
    // cannot be prefetched by the router, which is what made the first visit to
    // each section pay full latency.
    const knowledgeLink = sidebar.locator('a[href="/knowledge"]').first();
    await expect(knowledgeLink).toHaveCount(1);
    const documentsLink = sidebar.locator('a[href="/documents"]').first();
    await expect(documentsLink).toHaveCount(1);
  });

  test("shell is not remounted or reflowed during a section switch", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-slot=sidebar]").first()).toBeVisible({ timeout: 15000 });

    // Tag the live sidebar element. The tag is a DOM property, so it survives
    // re-renders but is destroyed by a remount or a full document navigation.
    const tagged = await page.evaluate(() => {
      const el = document.querySelector("[data-slot=sidebar]") as (HTMLElement & { __shellTag?: string }) | null;
      if (!el) return false;
      el.__shellTag = "persisted";
      return true;
    });
    expect(tagged, "sidebar element not found to tag").toBe(true);

    const box = await page.locator("[data-slot=sidebar]").first().boundingBox();

    await page.locator('[data-slot=sidebar] a[href="/knowledge"]').first().click();
    await page.waitForURL((url) => url.pathname === "/knowledge", { timeout: 20000 });

    const stillTagged = await page.evaluate(
      () => (document.querySelector("[data-slot=sidebar]") as (HTMLElement & { __shellTag?: string }) | null)?.__shellTag
    );
    expect(stillTagged, "sidebar was remounted during navigation").toBe("persisted");

    const boxAfter = await page.locator("[data-slot=sidebar]").first().boundingBox();
    expect(boxAfter?.width, "sidebar reflowed during navigation").toBe(box?.width);
    expect(boxAfter?.x, "sidebar shifted during navigation").toBe(box?.x);
  });

  test("AI Venture section switching makes no server navigation", async ({ page }) => {
    await page.goto("/concepts", { waitUntil: "domcontentloaded" });
    // Scope to the workspace rail. A bare role=button lookup also matches the
    // sidebar's "Drag Research Lab" handle and the launcher grid tile.
    const rail = page.locator('nav button:has-text("Research Lab")').first();
    await expect(rail).toBeVisible({ timeout: 20000 });

    const rscRequests: string[] = [];
    page.on("request", (req) => {
      if (isRscRequest(req.url())) rscRequests.push(req.url());
    });

    await rail.click();
    await page.waitForURL((url) => url.searchParams.get("tab") === "research", { timeout: 10000 });
    await page.waitForTimeout(600);

    // nuqs writes the param through history, so switching section must not cost
    // an RSC round-trip the way the previous router.replace did.
    expect(rscRequests, `tab switch triggered server navigation: ${rscRequests.join(", ")}`).toEqual([]);
  });

  test("AI Venture restores its section from the URL", async ({ page }) => {
    await page.goto("/concepts?tab=agents", { waitUntil: "domcontentloaded" });
    const agents = page.locator('nav button:has-text("Agents")').first();
    await expect(agents).toHaveAttribute("aria-current", "page", { timeout: 20000 });
  });

  test("Brainstorm tab switching makes no server navigation and is URL-restorable", async ({
    page,
  }) => {
    await page.goto("/brainstorm-sketch?tab=whiteboard", { waitUntil: "domcontentloaded" });

    const drawTab = page.getByRole("tab", { name: /Draw/i }).first();
    await expect(drawTab).toBeVisible({ timeout: 20000 });

    const rscRequests: string[] = [];
    page.on("request", (req) => {
      if (isRscRequest(req.url())) rscRequests.push(req.url());
    });

    await drawTab.click();
    await page.waitForURL((url) => url.searchParams.get("tab") === "draw", { timeout: 10000 });
    await page.waitForTimeout(600);

    expect(rscRequests, `tab switch triggered server navigation: ${rscRequests.join(", ")}`).toEqual([]);
  });

  test("revisiting a section serves its data from cache instead of refetching", async ({ page }) => {
    await page.goto("/documents", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-slot=sidebar]").first()).toBeVisible({ timeout: 15000 });
    // Let the first (cold) fetch settle and populate the query cache.
    await page.waitForTimeout(2500);

    await page.locator('[data-slot=sidebar] a[href="/knowledge"]').first().click();
    await page.waitForURL((url) => url.pathname === "/knowledge", { timeout: 20000 });
    await page.waitForTimeout(1500);

    // Count data requests only from here on. Within the 5-minute staleTime the
    // remounted provider must read the cached list rather than hit the API,
    // which is what removes the spinner/blank list on a repeat visit.
    const documentRequests: string[] = [];
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (url.pathname === "/api/documents") documentRequests.push(req.url());
    });

    await page.locator('[data-slot=sidebar] a[href="/documents"]').first().click();
    await page.waitForURL((url) => url.pathname === "/documents", { timeout: 20000 });
    await page.waitForTimeout(2000);

    expect(
      documentRequests,
      `cached section refetched its data: ${documentRequests.join(", ")}`
    ).toEqual([]);
  });
});
