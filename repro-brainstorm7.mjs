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
page.on("console", (m) => console.log("[C]", m.type(), m.text().slice(0,300)));

await page.goto("http://localhost:3000/brainstorm-sketch", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
await page.locator("aside button", { hasText: "New" }).click();
await page.waitForTimeout(4000);

const defined = await page.evaluate(() => !!customElements.get("affine-editor-container"));
console.log("DEFINED:", defined);
await browser.close();
