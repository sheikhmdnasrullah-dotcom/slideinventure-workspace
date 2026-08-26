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
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

console.log("--- start at dashboard, client-side nav to AI Venture (concepts) ---");
await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
await page.waitForTimeout(500);

await page.getByRole("button", { name: "AI Venture", exact: true }).click();
await page.waitForTimeout(3000);
console.log("url:", page.url());
let err = await page.getByText("hit a problem").count();
console.log("error boundary after opening AI Venture:", err > 0);

const conceptItems = await page.locator("aside button").allTextContents();
console.log("concepts sidebar items:", conceptItems);
const firstConcept = page.locator("aside button").nth(1);
if (await firstConcept.count()) {
  await firstConcept.click();
  await page.waitForTimeout(3000);
  err = await page.getByText("hit a problem").count();
  console.log("error boundary after opening a concepts workspace:", err > 0);
}

console.log("--- now client-side nav to Brainstorm Sketch ---");
await page.getByRole("button", { name: "Brainstorm Sketch", exact: true }).click();
await page.waitForTimeout(3000);
console.log("url:", page.url());
err = await page.getByText("hit a problem").count();
console.log("error boundary after navigating to Brainstorm:", err > 0);

const items = await page.locator("aside button").allTextContents();
console.log("brainstorm sidebar items:", items);

const firstBrainstorm = page.locator("aside button").nth(1);
if (await firstBrainstorm.count()) {
  await firstBrainstorm.click();
  await page.waitForTimeout(3000);
  err = await page.getByText("hit a problem").count();
  console.log("error boundary after opening a brainstorm workspace (from concepts):", err > 0);
}

await browser.close();
