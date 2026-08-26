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

const userId = "6a8d35e7000d628fd201"; // tanimsyt@gmail.com
const session = await users.createSession(userId);
console.log("session created, secret len:", session.secret.length);

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
page.on("console", (m) => { if (m.type() === "error" || /error/i.test(m.text())) console.log("CONSOLE ERROR:", m.text()); });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message, "\n", e.stack));

await page.goto("http://localhost:3000/brainstorm-sketch", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
console.log("=== loaded brainstorm-sketch, checking for error boundary text ===");
const hasError = await page.getByText("hit a problem").count();
console.log("error boundary visible:", hasError > 0);

// list workspace titles found in sidebar
const items = await page.locator("aside button").allTextContents();
console.log("sidebar items:", items);

await browser.close();
