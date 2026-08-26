import { chromium } from "playwright";
import fs from "fs";

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
  await page.getByRole("button", { name: /^pdfs$/i }).click();
  await page.waitForTimeout(1500);
  log("PDFs tab open");

  // ---- TEST 3: upload PDF -> close -> refresh -> PDF remains -> viewer works ----
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Upload PDF" }).click(),
  ]);
  await fileChooser.setFiles("/tmp/test.pdf");
  await page.waitForTimeout(2000);
  log("uploaded PDF");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "AI Venture" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /^pdfs$/i }).click();
  await page.waitForTimeout(1500);
  const pdfCard = page.getByText("test_pricing.pdf", { exact: false }).first();
  await pdfCard.waitFor({ timeout: 5000 });
  log("PDF persisted after refresh");

  await pdfCard.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/tmp/av_test3_pdf_viewer.png" });
  log("PDF viewer opened");

  // ---- TEST: Ask about this PDF ----
  await page.getByPlaceholder("What are the key opportunities here?").fill("What opportunity is mentioned?");
  await page.getByRole("button", { name: "Ask" }).click();
  await page.waitForSelector("text=Save to Research", { timeout: 30000 });
  const answerText = await page.locator("aside").innerText();
  log(`AI answer panel text: ${answerText.slice(0, 200)}`);

  // ---- Save to Research ----
  await page.getByRole("button", { name: "Save to Research" }).click();
  await page.waitForTimeout(1000);
  log("clicked Save to Research");

  await page.getByRole("button", { name: "Close" }).first().click().catch(() => {});
  await page.waitForTimeout(500);

  // ---- TEST 4: delete PDF -> refresh -> gone ----
  await page.getByRole("button", { name: /^pdfs$/i }).click();
  await page.waitForTimeout(1000);
  const trashIcon = page.locator(".group:has-text('test_pricing.pdf') svg.lucide-trash2");
  await trashIcon.click({ force: true });
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "AI Venture" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /^pdfs$/i }).click();
  await page.waitForTimeout(1500);
  const goneCount = await page.getByText("test_pricing.pdf", { exact: false }).count();
  log(`PDF gone after delete+refresh: ${goneCount === 0}`);

  // ---- TEST: search ----
  await page.getByRole("button", { name: /^overview$/i }).click();
  await page.waitForTimeout(500);
  await page.getByPlaceholder("Search everything…").fill("research");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/tmp/av_test_search.png" });
  log("search screenshot taken");

  console.log("ALL STEPS COMPLETE");
} catch (err) {
  console.log("ERROR:", err.message);
  await page.screenshot({ path: "/tmp/av_pdf_fail.png" }).catch(() => {});
} finally {
  await browser.close();
}
