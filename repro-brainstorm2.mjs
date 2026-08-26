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

const client = new Client()
  .setEndpoint(env.APPWRITE_ENDPOINT)
  .setProject(env.APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);
const users = new Users(client);
const userId = "6a8d35e7000d628fd201";
const session = await users.createSession(userId);

const browser = await chromium.launch();
const context = await browser.newContext();
await context.addCookies([{
  name: `a_session_${env.APPWRITE_PROJECT_ID}`,
  value: session.secret,
  domain: "localhost",
  path: "/",
  httpOnly: true,
  secure: false,
  sameSite: "Lax",
}]);
const page = await context.newPage();
let lastError = null;
page.on("pageerror", (e) => { lastError = e.message; console.log("PAGEERROR:", e.message); });

await page.goto("http://localhost:3000/brainstorm-sketch", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

const buttons = await page.locator("aside button").all();
const labels = await Promise.all(buttons.map(b => b.innerText()));
console.log("found", buttons.length, "items:", labels);

for (let i = 0; i < buttons.length; i++) {
  const label = labels[i].trim();
  if (label === "New" || !label) continue;
  lastError = null;
  console.log(`\n--- clicking item ${i}: "${label}" ---`);
  try {
    await page.locator("aside button").nth(i).click();
  } catch (e) {
    console.log("click failed:", e.message);
    continue;
  }
  await page.waitForTimeout(1200);
  const hasErrorBoundary = await page.getByText("hit a problem").count();
  console.log(`  -> error boundary: ${hasErrorBoundary > 0}, pageerror: ${lastError}`);
  if (hasErrorBoundary > 0) {
    console.log("  !!! CRASH REPRODUCED on:", label);
    break;
  }
  // reload back to list for next attempt if we navigated away or crashed silently
  await page.goto("http://localhost:3000/brainstorm-sketch", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
}

await browser.close();
