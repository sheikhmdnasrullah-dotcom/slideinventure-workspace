import { test, expect } from "@playwright/test";

const EMAIL = "tanimsyt@gmail.com";
const PASSWORD = "Trimtales@2026";

test.setTimeout(60000);

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30000 });
}

test("brainstorm notepad: open, write, autosave, persist across reopen", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await login(page);

  await page.goto("/brainstorm-sketch", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Brainstorm" })).toBeVisible();

  // Open the Notepad card.
  await page.getByTestId("brainstorm-notepad-open").click();
  await expect(page.getByRole("heading", { name: "Notepad", exact: true })).toBeVisible({ timeout: 30000 });

  // Create a note and type into the editor.
  const noteText = `Brainstorm note ${Date.now()}`;
  await page.getByRole("button", { name: "Write Note" }).click();
  const editor = page.locator('[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 10000 });
  await editor.click();
  await page.keyboard.type(noteText);

  // Wait for autosave to settle.
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10000 });

  // Close the dialog and reopen — the note must still be there.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Notepad", exact: true })).toHaveCount(0);

  await page.getByTestId("brainstorm-notepad-open").click();
  await expect(page.getByRole("heading", { name: "Notepad", exact: true })).toBeVisible({ timeout: 10000 });
  await page.getByText("Untitled note").first().click();
  await expect(page.getByText(noteText)).toBeVisible({ timeout: 10000 });

  const realPageErrors = pageErrors.filter((e) => !e.includes("Hydration failed"));
  expect(realPageErrors, `uncaught page errors:\n${realPageErrors.join("\n")}`).toEqual([]);
});
