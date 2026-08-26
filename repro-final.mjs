import { Client, Users } from "node-appwrite";
import { chromium } from "playwright";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const client = new Client().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setKey(env.APPWRITE_API_KEY);
const users = new Users(client);
const session = await users.createSession("6a8d35e7000d628fd201");

const browser = await chromium.launch();
const context = await browser.newContext();
await context.addCookies([{ name: `a_session_${env.APPWRITE_PROJECT_ID}`, value: session.secret, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" }]);
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
page.on("response", (r) => { if (r.status() >= 400) console.log("HTTP", r.status(), r.url()); });

await page.goto("http://localhost:3000/brainstorm-sketch", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.locator("aside button", { hasText: "New" }).click();
await page.waitForTimeout(3000);

const info1 = await page.evaluate(() => {
  const el = document.querySelector("affine-editor-container");
  const rect = el?.getBoundingClientRect();
  return { defined: !!customElements.get("affine-editor-container"), w: rect?.width, h: rect?.height };
});
console.log("after 1st workspace:", JSON.stringify(info1));

// Type into it
try {
  await page.locator("affine-editor-container").click({ timeout: 5000 });
  await page.keyboard.type("Testing the brainstorm editor after the fix.");
  console.log("typed successfully");
} catch (e) {
  console.log("typing failed:", e.message);
}
await page.waitForTimeout(1500); // let autosave (900ms debounce) fire

// Open a SECOND (different) workspace to trigger a remount + re-registration risk
await page.goto("http://localhost:3000/brainstorm-sketch", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const items = await page.locator("aside button").all();
if (items.length > 2) {
  await items[2].click();
  await page.waitForTimeout(2500);
  const info2 = await page.evaluate(() => {
    const el = document.querySelector("affine-editor-container");
    const rect = el?.getBoundingClientRect();
    return { w: rect?.width, h: rect?.height };
  });
  console.log("after opening a 2nd workspace (remount test):", JSON.stringify(info2));
}

const errBoundary = await page.getByText("hit a problem").count();
console.log("error boundary visible:", errBoundary > 0);

await browser.close();
