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
const marker = `findable-dbg4-${Date.now()}`;
const res = await page.request.post("http://localhost:3000/api/links", { data: { url: "https://example.com", title: marker } });
const { id } = await res.json();

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
const box = await result.boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
const info = await page.evaluate(({cx, cy}) => {
  const el = document.elementFromPoint(cx, cy);
  return {
    tag: el?.tagName,
    id: el?.id,
    className: el?.className,
    role: el?.getAttribute("role"),
    parentTag: el?.parentElement?.tagName,
    parentId: el?.parentElement?.id,
    parentRole: el?.parentElement?.getAttribute("role"),
  };
}, {cx, cy});
console.log("elementFromPoint:", JSON.stringify(info, null, 2));

await page.request.delete(`http://localhost:3000/api/links/${id}`);
await browser.close();
