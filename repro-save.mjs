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
page.on("response", (r) => { if (r.url().includes("/api/affine/") && r.request().method() === "PUT") console.log("PUT", r.status(), r.url()); });

await page.goto("http://localhost:3000/brainstorm-sketch", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.locator("aside button", { hasText: "New" }).click();
await page.waitForTimeout(3000);

await page.locator("affine-editor-container").click({ timeout: 5000 });
const marker = "SAVEMARKER-" + Date.now();
await page.keyboard.type(marker);
console.log("typed marker:", marker);
await page.waitForTimeout(3000); // well past the 900ms debounce

await browser.close();
console.log("done, checking DB...");
