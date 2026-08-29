import { test } from "./fixtures";

test("debug reacher ui", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (m) => logs.push(m.type() + ": " + m.text().slice(0, 160)));
  page.on("pageerror", (e) => logs.push("PAGEERROR: " + (e?.message || String(e))));

  await page.goto("/leads/verify", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /Lead Verification/i }).waitFor({ timeout: 30000 });

  const box = page.getByPlaceholder(/Paste emails/i);
  await box.fill("postmaster@reacher.email");
  const btn = page.getByRole("button", { name: /Verify with Reacher/i });
  console.log("btn disabled?", await btn.isDisabled());
  await btn.click();
  await page.waitForTimeout(8000);
  console.log("RESULTS VISIBLE EMAIL:", await page.getByText("postmaster@reacher.email").count());
  console.log("BODY SNIPPET:", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 500));
  console.log("LOGS:", JSON.stringify(logs.slice(0, 10)));
});
