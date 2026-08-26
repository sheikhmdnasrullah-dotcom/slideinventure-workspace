import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = "e2e-verify-test@slideinventure.com";
const PASSWORD = "E2eVaultTest_cq5r3d6m!9";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (msg) => msg.type() === "error" && console.log("CONSOLE ERROR:", msg.text()));
page.on("pageerror", (err) => console.log("PAGEERROR:", err.message));
page.on("console", (msg) => { if (msg.text().includes("DEBUG then")) console.log("CONSOLE:", msg.text()); });
page.on("response", (res) => {
  if (res.url().includes("/api/")) console.log("RESPONSE:", res.status(), res.url());
});

for (let attempt = 0; attempt < 4; attempt++) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((url) => url.pathname !== "/login", { timeout: 8000 });
    break;
  } catch {}
}

await page.goto(`${BASE}/ai-venture`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "AI Venture" }).waitFor({ timeout: 10000 });
await page.getByRole("button", { name: /^pdfs$/i }).click();
await page.waitForTimeout(1500);

const fileInput = page.locator('input[type="file"]');
await fileInput.setInputFiles("/tmp/test.pdf");
await page.waitForTimeout(2000);

await page.getByText("test.pdf", { exact: false }).first().click();
await page.waitForTimeout(2000);

const input = page.getByPlaceholder("What are the key opportunities here?");
console.log("input count:", await input.count());
console.log("input visible:", await input.isVisible().catch(() => "err"));
await input.click();
await input.fill("What opportunity is mentioned?");
console.log("input value after fill:", await input.inputValue());

const askBtn = page.getByRole("button", { name: "Ask" });
console.log("ask btn disabled:", await askBtn.isDisabled());
await askBtn.click();
console.log("clicked ask, waiting...");
await page.waitForTimeout(15000);
await page.screenshot({ path: "/tmp/debug_ask_result.png" });
console.log("done waiting");

await page.getByRole("button", { name: "Save to Research" }).click();
await page.waitForTimeout(1000);
console.log("clicked save to research");

await page.getByRole("button", { name: "Close" }).first().click();
await page.waitForTimeout(500);
await page.getByRole("main").getByRole("button", { name: "Research Lab" }).click();
await page.waitForTimeout(2000);
await page.getByText("Untitled Research").first().click();
await page.waitForSelector("text=Saved to this research canvas", { timeout: 15000 });
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/debug_research_lab.png" });
console.log("research lab screenshot taken");

await browser.close();
