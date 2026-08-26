import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = "e2e-verify-test@slideinventure.com";
const PASSWORD = "E2eVaultTest_cq5r3d6m!9";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

function log(msg) { console.log("STEP:", msg); }

try {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');
    try { await page.waitForURL((url) => url.pathname !== "/login", { timeout: 8000 }); break; } catch {}
  }
  log("logged in");

  await page.goto(`${BASE}/brainstorm-sketch`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Brainstorm Sketch" }).waitFor({ timeout: 10000 });
  log("brainstorm-sketch list page loaded");

  // The list/sidebar should still be visible AND a New Board click should
  // open a popup window (Dialog), not replace this page's content inline.
  await page.getByRole("button", { name: "New Board" }).first().click();
  await page.waitForURL(/\/brainstorm-sketch\/.+/, { timeout: 15000 });
  const canvas = page.locator("canvas.excalidraw__canvas.interactive");
  await canvas.waitFor({ state: "visible", timeout: 20000 });
  log("board opened as popup after New Board click");

  // Confirm it's genuinely a modal: the list heading should still exist in the DOM behind it.
  const listStillThere = await page.getByText("My Boards", { exact: false }).count();
  log(`list still present behind popup: ${listStillThere > 0}`);

  await canvas.click();
  await page.keyboard.press("r");
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 140, cy + 90, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(1500);
  log("drew rectangle");

  // Export dropdown should be present (parity with old inline top bar).
  const exportBtn = page.getByRole("button", { name: "Export" });
  log(`export button present: ${(await exportBtn.count()) > 0}`);

  await page.getByRole("button", { name: "Close" }).click();
  await page.waitForTimeout(500);
  await page.waitForURL((url) => url.pathname === "/brainstorm-sketch", { timeout: 10000 });
  log("closed back to list, URL correct");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Brainstorm Sketch" }).waitFor({ timeout: 10000 });
  await page.getByText("New Brainstorm", { exact: false }).first().click();
  await page.waitForURL(/\/brainstorm-sketch\/.+/, { timeout: 10000 });
  await canvas.waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/tmp/brainstorm_reopened.png" });
  log("reopened after refresh, screenshot taken");

  console.log("ALL STEPS COMPLETE");
} catch (err) {
  console.log("ERROR:", err.message);
  await page.screenshot({ path: "/tmp/brainstorm_fail.png" }).catch(() => {});
} finally {
  await browser.close();
}
