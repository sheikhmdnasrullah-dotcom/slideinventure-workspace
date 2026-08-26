import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage();
const EMAIL = "e2e-verify-test@slideinventure.com";
const PASSWORD = "E2eVaultTest_cq5r3d6m!9";
for (let a=0;a<4;a++){
  await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(300);
  await page.fill("#email",EMAIL); await page.fill("#password",PASSWORD);
  await page.click('button[type="submit"]');
  try{ await page.waitForURL(u=>u.pathname!=="/login",{timeout:8000}); break; }catch{}
}
await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
await page.locator("body").click();
await page.keyboard.press("Meta+k");
await page.waitForTimeout(500);
// Click the "Activity" Navigate entry (no query typed, empty-state list).
const activityEntry = page.getByText("Activity", { exact: true }).first();
await activityEntry.waitFor({ timeout: 5000 });
await activityEntry.click();
await page.waitForTimeout(1500);
console.log("url after clicking Navigate entry:", page.url());
await browser.close();
