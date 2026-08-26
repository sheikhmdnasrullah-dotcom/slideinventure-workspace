import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = "e2e-verify-test@slideinventure.com";
const PASSWORD = "E2eVaultTest_cq5r3d6m!9";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (msg) => console.log("CONSOLE:", msg.type(), msg.text()));
page.on("pageerror", (err) => console.log("PAGEERROR:", err.message));
page.on("requestfailed", (req) => console.log("REQFAILED:", req.url(), req.failure()?.errorText));
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
  } catch {
    if (attempt === 3) throw new Error("login retries exhausted");
  }
}

await page.goto(`${BASE}/ai-venture`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "AI Venture" }).waitFor({ timeout: 10000 });

await page.getByRole("button", { name: /^ideas$/i }).click();
await page.waitForTimeout(5000);
await page.screenshot({ path: "/tmp/debug_ideas_tab.png" });
console.log("current URL:", page.url());

const html = await page.locator("body").innerHTML();
console.log("has 'Untitled idea' text:", html.includes("Untitled idea"));
console.log("has 'No ideas yet' text:", html.includes("No ideas yet"));

await browser.close();
