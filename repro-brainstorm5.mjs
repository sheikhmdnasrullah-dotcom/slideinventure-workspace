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
page.on("console", (m) => { const t = m.text(); if (m.type()==="error" && !/hydrat|asChild/i.test(t)) console.log("CERR:", t.slice(0,300)); });

await page.goto("http://localhost:3000/brainstorm-sketch", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.locator("aside button", { hasText: "New" }).click();
await page.waitForTimeout(3000);

const info = await page.evaluate(() => {
  const el = document.querySelector("affine-editor-container");
  if (!el) return { found: false };
  const rect = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    found: true,
    rect: { w: rect.width, h: rect.height },
    display: cs.display,
    visibility: cs.visibility,
    hasShadowRoot: !!el.shadowRoot,
    innerHTML_len: el.innerHTML.length,
    hasDoc: !!(el).doc,
    mode: (el).mode,
  };
});
console.log("editor element info:", JSON.stringify(info, null, 2));
await browser.close();
