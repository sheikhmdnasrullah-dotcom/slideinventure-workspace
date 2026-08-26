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
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message, e.stack));
page.on("response", (r) => { if (r.status() >= 400) console.log("HTTP", r.status(), r.url()); });
page.on("console", (m) => { if (m.type()==="error" && !/hydrat|asChild/i.test(m.text())) console.log("CONSOLE ERROR:", m.text().slice(0,400)); });

await page.goto("http://localhost:3000/brainstorm-sketch", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

console.log("--- clicking New to create a brand-new workspace ---");
await page.locator("aside button", { hasText: "New" }).click();
await page.waitForTimeout(3000);
let err = await page.getByText("hit a problem").count();
console.log("error boundary after creating New:", err > 0);

console.log("--- typing into the editor ---");
try {
  await page.locator("affine-editor-container").click({ timeout: 5000 });
  await page.keyboard.type("Hello from repro script testing the brainstorm editor");
  await page.waitForTimeout(1500);
} catch (e) {
  console.log("editor interaction failed:", e.message);
}
err = await page.getByText("hit a problem").count();
console.log("error boundary after typing:", err > 0);

await page.waitForTimeout(1500); // let autosave fire
const bodyText = await page.locator("body").innerText();
console.log("has 'hit a problem' anywhere:", bodyText.includes("hit a problem"));

await browser.close();
