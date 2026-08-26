import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => { if (m.text().includes("DEBUG")) console.log("CONSOLE:", m.text()); });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
page.on("console", (m) => { if (m.text().includes("DEBUG")) console.log("CONSOLE:", m.text()); });
const EMAIL = "e2e-verify-test@slideinventure.com";
const PASSWORD = "E2eVaultTest_cq5r3d6m!9";
for (let a=0;a<4;a++){
  await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(300);
  await page.fill("#email",EMAIL); await page.fill("#password",PASSWORD);
  await page.click('button[type="submit"]');
  try{ await page.waitForURL(u=>u.pathname!=="/login",{timeout:8000}); break; }catch{}
}
const marker = `findable-debug-${Date.now()}`;
const res = await page.request.post("http://localhost:3000/api/links", { data: { url: "https://example.com", title: marker } });
const { id } = await res.json();
console.log("created link", id);

await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
await page.locator("body").click();
await page.keyboard.press("Meta+k");
const input = page.getByPlaceholder(/search everything/i);
await input.waitFor({ timeout: 8000 });
await input.fill(marker);
await page.waitForTimeout(700);

const result = page.getByText(marker, { exact: false }).first();
await result.waitFor({ timeout: 5000 });
console.log("TS result found at", Date.now());
const box = await result.boundingBox();
console.log("TS result box:", Date.now(), box);
await result.click();
console.log("TS click() returned at", Date.now());
await page.waitForTimeout(1500);
console.log("url after click:", page.url());
const menuStillOpen = await page.getByPlaceholder(/search everything/i).count();
console.log("menu still open:", menuStillOpen > 0);

await page.request.delete(`http://localhost:3000/api/links/${id}`);
await browser.close();
