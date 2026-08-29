import { test, expect } from "@playwright/test";
import { Client, Users, Query } from "node-appwrite";

try {
  process.loadEnvFile(".env.local");
} catch {
  // fine if already loaded
}

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

test.describe("Personal Operating System Command Center", () => {
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

  test("loads Command Center with live time, greeting, contextual message, and today at a glance", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Verify header elements
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText(/Today at a Glance/i)).toBeVisible();
    await expect(page.getByText(/Manual Stopwatch/i)).toBeVisible();
    await expect(page.getByText(/Work Time Intelligence/i)).toBeVisible();
    await expect(page.getByText(/What Changed/i)).toBeVisible();
    await expect(page.getByText(/Continue Where You Left Off/i)).toBeVisible();
    await expect(page.getByText(/Needs Attention/i)).toBeVisible();
    await expect(page.getByText(/Next Best Move/i)).toBeVisible();

    expect(pageErrors).toHaveLength(0);
  });

  test("stopwatch lifecycle: start, tick, navigate across sections with persistent status, stop, and save session", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Click START WORKING
    const startBtn = page.getByRole("button", { name: /START WORKING/i }).first();
    await startBtn.click();
    await page.waitForTimeout(1200);

    // Verify status switched to WORKING
    await expect(page.getByText(/● WORKING/i).first()).toBeVisible();

    // Verify counter is ticking
    const counter = page.locator("#stopwatch-section").getByText(/00:00:0[1-9]/i).first();
    await expect(counter).toBeVisible({ timeout: 5000 });

    // Navigate to /notepad - verify global live status in header stays active
    await page.goto("/notepad", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const headerStatus = page.locator("header").getByText(/00:00:/i);
    await expect(headerStatus).toBeVisible();

    // Refresh page - verify timer state recovery
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await expect(page.locator("header").getByText(/00:00:/i)).toBeVisible();

    // Return to /dashboard
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Wait at least 4s total so duration >= 3s to save
    await page.waitForTimeout(3000);

    // Click STOP & SAVE
    const stopBtn = page.getByRole("button", { name: /STOP & SAVE/i }).first();
    await stopBtn.click();
    await page.waitForTimeout(1500);

    // Verify timer reset to idle
    await expect(page.getByRole("button", { name: /START WORKING/i }).first()).toBeVisible();
  });

  test("quick action buttons and command palette integration", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Verify quick action buttons
    await expect(page.getByRole("button", { name: /New note/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Research Lab/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /New board/i }).first()).toBeVisible();

    // Open command palette via button
    const cmdPaletteBtn = page.getByRole("button", { name: /Command palette/i }).first();
    await cmdPaletteBtn.click();
    await page.waitForTimeout(500);

    // Verify Command Palette opened
    await expect(page.getByPlaceholder("Search the workspace")).toBeVisible();
    await expect(page.getByLabel("Actions").getByText("Start work timer")).toBeVisible();

    // Close with Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });
});
