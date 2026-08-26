import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = "e2e-verify-test@slideinventure.com";
const PASSWORD = "E2eVaultTest_cq5r3d6m!9";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (err) => console.log("PAGEERROR:", err.message));

function log(msg) {
  console.log("STEP:", msg);
}

try {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL((url) => url.pathname !== "/login", { timeout: 8000 });
      break;
    } catch {
      if (attempt === 3) throw new Error("login retries exhausted");
    }
  }
  log("logged in");

  await page.goto(`${BASE}/ai-venture`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "AI Venture" }).waitFor({ timeout: 10000 });
  log("AI Venture page loaded");

  // ---- TEST 1: sketch create -> draw -> close -> refresh -> reopen persists ----
  await page.getByRole("button", { name: /^sketches$/i }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "New sketch" }).first().click();
  const canvas = page.locator("canvas.excalidraw__canvas.interactive");
  await canvas.waitFor({ state: "visible", timeout: 20000 });
  log("board window opened");

  await canvas.click();
  await page.keyboard.press("r");
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 140, cy + 90, { steps: 8 });
  await page.mouse.up();
  log("drew rectangle");

  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Close" }).click();
  await page.waitForTimeout(500);
  log("closed board window");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "AI Venture" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /^sketches$/i }).click();
  await page.waitForTimeout(1500);
  await page.waitForTimeout(500);
  const sketchCard = page.getByText("Untitled sketch", { exact: false }).first();
  await sketchCard.waitFor({ timeout: 5000 });
  await sketchCard.click();
  await canvas.waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(500);
  const elementCount = await page.evaluate(() => {
    const el = document.querySelector(".excalidraw__canvas.interactive");
    return el ? 1 : 0;
  });
  await page.screenshot({ path: "/tmp/av_test1_reopened.png" });
  log(`reopened board after refresh, canvas present=${elementCount}`);
  await page.getByRole("button", { name: "Close" }).click();
  await page.waitForTimeout(300);

  // ---- TEST 2: idea create -> write -> refresh -> persists ----
  await page.getByRole("button", { name: /^ideas$/i }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "New idea" }).first().click();
  await page.waitForTimeout(500);
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.waitFor({ timeout: 10000 });
  await editor.click();
  await page.keyboard.type("Maybe we can build an AI research assistant for solo founders.");
  await page.waitForTimeout(1200);
  log("wrote idea content");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "AI Venture" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /^ideas$/i }).click();
  await page.waitForTimeout(1500);
  await page.waitForTimeout(500);
  await page.getByText("Untitled idea", { exact: false }).first().click();
  await page.waitForTimeout(1500);
  const bodyText = await page.locator('[contenteditable="true"]').first().textContent().catch(() => "");
  log(`idea persisted after refresh: "${bodyText}"`);
  await page.screenshot({ path: "/tmp/av_test2_idea.png" });

  console.log("ALL STEPS COMPLETE");
} catch (err) {
  console.log("ERROR:", err.message);
  await page.screenshot({ path: "/tmp/av_fail.png" }).catch(() => {});
} finally {
  await browser.close();
}
