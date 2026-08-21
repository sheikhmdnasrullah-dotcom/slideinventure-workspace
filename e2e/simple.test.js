const { test, expect } = require("@playwright/test");

test("homepage loads", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page).toHaveTitle(/SlideIn Venture/);
});

test("theme toggle works", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  await page.addInitScript((t) => {
    try { localStorage.setItem("theme", t); } catch {}
  }, "night");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const htmlClass = await page.getAttribute("html", "class");
  expect(htmlClass).toContain("dark");
});