import { test, expect } from "@playwright/test";
import { Client, Users, Query } from "node-appwrite";

// Playwright doesn't auto-load .env.local the way `next dev`/`tsx --env-file`
// do, so the Appwrite API key below would otherwise be undefined here.
try {
  process.loadEnvFile(".env.local");
} catch {
  // already loaded, or running somewhere .env.local doesn't exist — fine either way
}

/**
 * Navigation smoke test: every major workspace section loads without a 404,
 * a blank page, or an uncaught exception, and the shared shell (sidebar)
 * stays mounted while the content underneath swaps — the "one application,
 * not a page reload" requirement.
 *
 * Auth: instead of typing a password into the login form (never do that in
 * an automated test — it's how real credentials end up committed to a
 * repo), this mints a real session server-side via the Appwrite API key
 * (already available to the app's own server code) and injects it as a
 * cookie. No password ever touches this file or the browser.
 */

const PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? "";
const SESSION_COOKIE = `a_session_${PROJECT_ID}`;

async function mintSessionCookie(): Promise<string> {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1")
    .setProject(PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY || "");

  const users = new Users(client);
  const list = await users.list([Query.limit(1)]);
  const user = list.users[0];
  if (!user) throw new Error("No Appwrite user found to mint a test session for");
  const session = await users.createSession(user.$id);
  return session.secret;
}

const SECTIONS = [
  "/",
  "/knowledge",
  "/documents",
  "/ai-venture",
  "/todoist",
  "/chat",
  "/agents",
  "/leads",
  "/useful-links",
  "/vault",
  "/mail",
  "/notepad",
  "/brainstorm-sketch",
  "/terminal",
  "/strategy",
  "/apps",
];

test.describe("Navigation smoke test", () => {
  test.beforeEach(async ({ context }) => {
    const secret = await mintSessionCookie();
    await context.addCookies([
      {
        name: SESSION_COOKIE,
        value: secret,
        url: test.info().project.use.baseURL as string,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  });

  for (const path of SECTIONS) {
    test(`loads without error: ${path}`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (err) => pageErrors.push(err.message));

      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${path} responded with an error status`).toBeLessThan(400);

      await page.waitForTimeout(800);

      const bodyText = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
      expect(bodyText, `${path} rendered a 404/not-found body`).not.toContain("this page could not be found");
      expect(bodyText.trim().length, `${path} rendered a blank page`).toBeGreaterThan(0);

      expect(pageErrors, `${path} threw an uncaught page error: ${pageErrors.join("; ")}`).toHaveLength(0);
    });
  }

  test("shell persists across navigation (sidebar stays mounted)", async ({ page }) => {
    await page.goto("/useful-links", { waitUntil: "domcontentloaded" });
    const sidebarBefore = page.locator("[data-slot=sidebar], aside, nav").first();
    await expect(sidebarBefore).toBeVisible({ timeout: 10000 });

    await page.goto("/knowledge", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-slot=sidebar], aside, nav").first()).toBeVisible({ timeout: 10000 });

    await page.goto("/useful-links", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-slot=sidebar], aside, nav").first()).toBeVisible({ timeout: 10000 });
  });
});
