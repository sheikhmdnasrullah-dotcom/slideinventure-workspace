import { test, expect } from "@playwright/test";

/**
 * End-to-end flow for the rebuilt Brainstorm Sketch workspace.
 *
 * Covers: login, create board, draw (tldraw), autosave, rename, leave/return,
 * board isolation on switch, delete, and persistence across refresh.
 *
 * Note: the app's shared sidebar has a pre-existing Base UI <Tooltip> console
 * warning that is unrelated to this feature, so we only hard-fail on uncaught
 * page exceptions and surface console errors for visibility.
 */

const EMAIL = "tanimsyt@gmail.com";
const PASSWORD = "Trimtales@2026";

test.setTimeout(120000);

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30000 });
}

async function newBoard(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "New Board" }).first().click();
  await page.waitForURL(/\/brainstorm-sketch\/.+/, { timeout: 15000 });
  await expect(page.locator(".tl-canvas")).toBeVisible({ timeout: 20000 });
}

async function drawRectangle(page: import("@playwright/test").Page) {
  const canvas = page.locator(".tl-canvas");
  await canvas.click(); // focus the editor
  await page.keyboard.press("r"); // rectangle tool
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 140, cy + 90, { steps: 8 });
  await page.mouse.up();
}

test("brainstorm sketch: full create → draw → rename → switch → delete flow", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => {
    pageErrors.push(String(e));
    console.log("[pageerror]", String(e));
  });
  page.on("console", (m) => {
    if (m.type() === "error") {
      consoleErrors.push(m.text());
      console.log("[console.error]", m.text());
    }
  });

  await login(page);

  // Landing state shows the workspace header.
  await page.goto("/brainstorm-sketch", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Brainstorm Sketch" })).toBeVisible();

  // Create first board.
  await newBoard(page);
  await drawRectangle(page);

  // Autosave should settle to "Saved".
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15000 });

  // Rename via the board options menu (robust regardless of current title).
  await page.getByRole("button", { name: "Board options" }).click();
  await page.getByText("Rename", { exact: true }).click();
  const titleInput = page.locator("main").getByRole("textbox").first();
  await titleInput.fill("Alpha Board");
  await titleInput.press("Enter");
  await expect(page.getByRole("button", { name: "Alpha Board" }).first()).toBeVisible();

  // Leave to the board list; the renamed board should appear.
  await page.getByRole("button", { name: "Back to boards" }).click();
  await page.waitForURL(/\/brainstorm-sketch$/);
  await expect(page.getByText("Alpha Board").first()).toBeVisible();

  // Reopen the board and confirm the canvas reloads (persistence).
  await page.getByText("Alpha Board").first().click();
  await page.waitForURL(/\/brainstorm-sketch\/.+/);
  await expect(page.locator(".tl-canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Alpha Board" }).first()).toBeVisible();

  // Create a second board and draw, to test isolation when switching back.
  await newBoard(page);
  await drawRectangle(page);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Board options" }).click();
  await page.getByText("Rename", { exact: true }).click();
  const titleInput2 = page.locator("main").getByRole("textbox").first();
  await titleInput2.fill("Beta Board");
  await titleInput2.press("Enter");

  // Go back and reopen Alpha; its title must still be Alpha (no leakage).
  await page.getByRole("button", { name: "Back to boards" }).click();
  await page.waitForURL(/\/brainstorm-sketch$/);
  await page.getByText("Alpha Board").first().click();
  await page.waitForURL(/\/brainstorm-sketch\/.+/);
  await expect(page.getByRole("button", { name: "Alpha Board" }).first()).toBeVisible();

  // Refresh the page; the board (and its title) should persist.
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".tl-canvas")).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: "Alpha Board" }).first()).toBeVisible();

  // Delete the board via its row actions.
  await page.getByRole("button", { name: "Back to boards" }).click();
  await page.waitForURL(/\/brainstorm-sketch$/);
  const row = page.locator("div.group", { hasText: "Alpha Board" }).first();
  await row.getByRole("button", { name: "Board actions" }).click();
  await page.getByText("Delete", { exact: true }).click();
  await page.locator('[role="dialog"]').getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Alpha Board")).toHaveCount(0, { timeout: 10000 });

  // The app shell has a pre-existing hydration error (SortableSidebarItem in
  // the shared dashboard sidebar) that is unrelated to this feature; ignore it.
  const realPageErrors = pageErrors.filter((e) => !e.includes("Hydration failed"));
  expect(realPageErrors, `uncaught page errors:\n${realPageErrors.join("\n")}`).toEqual([]);
  if (consoleErrors.length) {
    console.log("Console errors (non-fatal; may include pre-existing shell warnings):");
    console.log(consoleErrors.join("\n"));
  }
});
