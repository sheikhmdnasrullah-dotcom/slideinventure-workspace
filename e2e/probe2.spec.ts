import { test } from "./fixtures";
test("debug7", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (m) => { const t=m.text(); if(t.includes("REACHER_PANEL")) logs.push(t); });
  await page.goto("/leads/verify", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /Lead Verification/i }).waitFor({ timeout: 30000 });
  await page.getByPlaceholder(/Paste emails/i).fill("postmaster@reacher.email");
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) => /Verify with Reacher/i.test(x.textContent || "")) as HTMLButtonElement;
    b?.click();
  });
  await page.waitForTimeout(15000);
  console.log("LOGS:", JSON.stringify(logs));
  console.log("EMAIL COUNT:", await page.getByText("postmaster@reacher.email").count());
});
