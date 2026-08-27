import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const raw = readFileSync("/tmp/kilo/session.txt", "utf8").trim();
const m = raw.match(/^(a_session_[a-f0-9]+)=(.*)$/)!;
const name = m[1];
const value = m[2];
console.log("cookie name:", name, "value len:", value.length);

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addCookies([{ name, value, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
const page = await ctx.newPage();
const res = await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
console.log("dashboard status:", res?.status());
const cookies = await ctx.cookies("http://localhost:3000");
console.log("cookies set:", cookies.map((c) => `${c.name}=${c.value.slice(0, 12)}...`));
const body = await page.locator("body").innerText().catch(() => "");
console.log("body snippet:", body.slice(0, 120));
await browser.close();
