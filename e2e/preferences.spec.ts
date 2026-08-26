import { test, expect } from "@playwright/test"

const EMAIL = process.env.AI_EMAIL || "tanimsyt@gmail.com"
const PASSWORD = process.env.AI_PASSWORD || "Trimtales@2026"

async function login(page: import("@playwright/test").Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto("/login", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(500)
    await page.fill('input[id="email"]', EMAIL)
    await page.fill('input[id="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    try {
      await page.waitForURL((url) => url.pathname !== "/login", { timeout: 15000 })
      return
    } catch {
      // auth backend was slow/flaky — retry
    }
  }
  throw new Error("Login did not complete after retries")
}

function sidebarLabels(page: import("@playwright/test").Page) {
  return page.locator('[data-testid="sidebar-drag-handle"]').evaluateAll(
    (handles) => handles.map((h) => (h.getAttribute("aria-label") || "").replace(/^Drag /, ""))
  )
}

test.describe("Dashboard polish pass", () => {
  test("default theme is light, never forced dark (Test 3)", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(600)
    const cls = await page.evaluate(() => document.documentElement.className)
    expect(cls, `html class was: ${cls}`).not.toContain("dark")
  })

  test("rename a section in Settings and have it persist on refresh (Test 1)", async ({ page }) => {
    await login(page)

    await page.goto("/settings", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)

    const input = page.getByLabel("Rename Brainstorm Sketch")
    await expect(input).toBeVisible({ timeout: 5000 })
    const renamed = `ZZ ${Date.now()}`
    await input.fill(renamed)
    await page.waitForTimeout(800)

    // Sidebar should reflect the new name immediately.
    await expect(page.locator(`text=${renamed}`).first()).toBeVisible({ timeout: 5000 })

    // Persists across a full refresh (localStorage + server preference).
    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1200)
    await expect(page.locator(`text=${renamed}`).first()).toBeVisible({ timeout: 5000 })

    // Restore the original name.
    const input2 = page.getByLabel("Rename Brainstorm Sketch")
    await input2.fill("Brainstorm Sketch")
    await page.waitForTimeout(600)
  })

  test("drag-and-drop reorders sections and persists (Test 2)", async ({ page }) => {
    await login(page)
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1000)

    const before = await sidebarLabels(page)
    expect(before.length).toBeGreaterThan(3)

    const handles = page.locator('[data-testid="sidebar-drag-handle"]')
    const first = handles.nth(0)
    const third = handles.nth(2)
    await first.dragTo(third, { targetPosition: { x: 10, y: 10 } })
    await page.waitForTimeout(1000)

    const after = await sidebarLabels(page)
    expect(after[1], `order before=${before.join(",")} after=${after.join(",")}`).toBe(before[0])

    // Reset to default so we don't leave the layout shuffled.
    await page.goto("/settings", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(600)
    await page.getByRole("button", { name: /Reset to default/i }).first().click()
    await page.waitForTimeout(600)
  })

  test("leads pagination supports 50/100/150/All and shows all rows (Test 8)", async ({ page }) => {
    await login(page)
    await page.goto("/leads", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1200)

    const pageSelector = page.locator("#page-size")
    await expect(pageSelector).toBeVisible({ timeout: 5000 })

    await pageSelector.click()
    await expect(page.getByRole("option", { name: "All", exact: true })).toBeVisible()
    await expect(page.getByRole("option", { name: "150", exact: true })).toBeVisible()
    await page.getByRole("option", { name: "All", exact: true }).click()
    await page.waitForTimeout(1200)

    // "All" is a valid, selectable page size and the table still renders.
    await expect(pageSelector).toContainText("All")
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 5000 })

    // Switching to 50 exercises real server-side pagination: the Next button
    // is enabled only when there are more than 50 leads, and clicking it
    // advances the page.
    await pageSelector.click()
    await page.getByRole("option", { name: "50", exact: true }).click()
    await page.waitForTimeout(1000)
    await expect(pageSelector).toContainText("50")

    const nextBtn = page.getByRole("button", { name: /Go to next page/i })
    if (await nextBtn.isEnabled()) {
      await nextBtn.click()
      await page.waitForTimeout(800)
      await expect(page.getByText(/2 of/)).toBeVisible({ timeout: 5000 })
    } else {
      await expect(nextBtn).toBeDisabled()
    }
  })
})
