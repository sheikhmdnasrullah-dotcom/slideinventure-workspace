import { test, expect, authenticate } from "./fixtures";

test("debug auth", async ({ page }, info) => {
  await authenticate(page.context(), "http://localhost:3000");
  const cookies = await page.context().cookies("http://localhost:3000");
  console.log("COOKIES:", JSON.stringify(cookies.map((c) => ({ name: c.name, len: c.value.length }))));
  const res = await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  console.log("STATUS:", res?.status());
  const api = await page.evaluate(async () => {
    const r = await fetch("/api/dashboard");
    return { status: r.status };
  });
  console.log("API:", JSON.stringify(api));
  expect(res?.status()).toBe(200);
});
