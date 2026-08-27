import { test, expect, authenticate } from "./fixtures";

test("debug notepad create", async ({ page }) => {
  await authenticate(page.context(), "http://localhost:3000");
  const responses: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/notes")) responses.push(`${r.request().method()} ${r.status()} ${r.url()}`);
  });

  await page.goto("/notepad", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: /New note/i }).first().click();
  await page.waitForTimeout(3000);

  const mainText = await page.locator("main").innerText().catch(() => "NO MAIN");
  const untitledVisible = await page.getByPlaceholder("Untitled").first().isVisible().catch(() => false);
  console.log("UNTITLED_VISIBLE:", untitledVisible);
  console.log("MAIN_SNIPPET:", mainText.slice(0, 300));
  console.log("API_RESPONSES:", JSON.stringify(responses, null, 2));
  expect(true).toBe(true);
});
