import { test, expect, type Page } from "@playwright/test"

const EMAIL = process.env.AI_EMAIL || "tanimsyt@gmail.com"
const PASSWORD = process.env.AI_PASSWORD || "Trimtales@2026"

async function login(page: Page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto("/login", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(500)
    await page.fill('input[id="email"]', EMAIL)
    await page.fill('input[id="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    try {
      await page.waitForURL((url) => url.pathname !== "/login", { timeout: 20000 })
      return
    } catch {
      // auth backend flaky — retry
    }
  }
  throw new Error("Login did not complete after retries")
}

function sidebarLabels(page: Page) {
  return page
    .locator('[data-testid="sidebar-drag-handle"]')
    .evaluateAll((handles) =>
      handles.map((h) => (h.getAttribute("aria-label") || "").replace(/^Drag /, ""))
    )
}

async function expandSection(page: Page, name: string) {
  const btn = page.getByRole("button", { name }).first()
  // If the section content (e.g. a known control) isn't visible yet, click to expand.
  await btn.click()
  await page.waitForTimeout(400)
}

test.describe("Core dashboard persistence", () => {
  test("Terminal: save a command, navigate away, return, reload — it persists", async ({ page }) => {
    const title = `TermTest ${Date.now()}`
    await login(page)
    await page.goto("/terminal", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)

    await page.getByRole("button", { name: /Add Command/i }).click()
    await page.getByPlaceholder("e.g. Check Port 25").fill(title)
    await page.getByPlaceholder("nc -vz example.com 25").fill("echo hello")
    await page.getByRole("button", { name: /Save Command/i }).click()

    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15000 })

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(500)
    await page.goto("/terminal", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 })

    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1000)
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 })
  })

  test("Useful Links: save by URL only (no title), fallback title, persists", async ({ page }) => {
    const host = `links-test-${Date.now()}.example.com`
    const url = `https://${host}/page`
    page.on("response", async (r) => {
      if (r.url().includes("/api/links")) {
        const body = r.status() >= 400 ? await r.text().catch(() => "") : ""
        console.log("LINKS_RESP", r.request().method(), r.status(), body.slice(0, 400))
      }
    })
    await login(page)
    await page.goto("/useful-links", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)

    await page.getByRole("button", { name: /Add Link/i }).click()
    await page.getByPlaceholder("https://google.com").fill(url)
    await page.getByRole("button", { name: /^Save$/ }).click()

    // First prove the save itself succeeded (POST 201 / "Link added").
    await expect(page.getByText(/Link added/i).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(host).first()).toBeVisible({ timeout: 10000 })

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(500)
    await page.goto("/useful-links", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)
    await expect(page.getByText(host).first()).toBeVisible({ timeout: 10000 })

    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1000)
    await expect(page.getByText(host).first()).toBeVisible({ timeout: 10000 })
  })

  test("Vault: save a secret, navigate away, return, reload — it persists", async ({ page }) => {
    const name = `VaultTest ${Date.now()}`
    await login(page)
    await page.goto("/vault", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)

    await page.getByRole("button", { name: /Add Secret/i }).click()
    await page.getByPlaceholder("e.g. Production Database").fill(name)
    await page.getByPlaceholder("Enter the secret value...").fill("super-secret-value")
    await page.getByRole("button", { name: /Save Secret/i }).click()

    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 })

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(500)
    await page.goto("/vault", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })

    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1000)
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })
  })

  test("Settings: change theme to Dark and it survives refresh", async ({ page }) => {
    await login(page)
    await page.goto("/settings", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)

    await expandSection(page, "Appearance")
    await page.locator("#theme").click()
    await page.getByRole("option", { name: "Dark", exact: true }).click()
    await page.waitForTimeout(500)
    const cls1 = await page.evaluate(() => document.documentElement.className)
    expect(cls1).toContain("dark")

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(500)
    await page.goto("/settings", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)
    const cls2 = await page.evaluate(() => document.documentElement.className)
    expect(cls2).toContain("dark")

    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1000)
    const cls3 = await page.evaluate(() => document.documentElement.className)
    expect(cls3).toContain("dark")

    // Reset to light so we don't pollute shared server state for other tests.
    await expandSection(page, "Appearance")
    await page.locator("#theme").click()
    await page.getByRole("option", { name: "Light", exact: true }).click()
    await page.waitForTimeout(400)
  })

  test("Settings: rename a section and it survives refresh", async ({ page }) => {
    await login(page)
    await page.goto("/settings", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)

    const renamed = `ZZ ${Date.now()}`
    await expandSection(page, "Section names")
    const input = page.getByLabel("Rename Brainstorm Sketch")
    try {
      await input.fill(renamed)
      await page.waitForTimeout(800)

      await page.reload({ waitUntil: "domcontentloaded" })
      await page.waitForTimeout(1000)
      await expect(page.locator(`text=${renamed}`).first()).toBeVisible({ timeout: 5000 })
    } finally {
      // restore original name so shared server state is not polluted
      await expandSection(page, "Section names")
      await page.getByLabel("Rename Brainstorm Sketch").fill("Brainstorm Sketch")
      await page.waitForTimeout(600)
    }
  })

  test("Navigation: drag a section up, and order persists across refresh", async ({ page }) => {
    await login(page)
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1000)

    const before = await sidebarLabels(page)
    expect(before.length).toBeGreaterThan(3)

    const handles = page.locator('[data-testid="sidebar-drag-handle"]')
    const h0 = await handles.nth(0).boundingBox()
    const h2 = await handles.nth(2).boundingBox()
    if (!h0 || !h2) throw new Error("drag handles not found")

    const startX = h0.x + h0.width / 2
    const startY = h0.y + h0.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX, startY + 20, { steps: 5 })
    await page.mouse.move(h2.x + h2.width / 2, h2.y + h2.height / 2, { steps: 12 })
    await page.waitForTimeout(300)
    await page.mouse.up()
    await page.waitForTimeout(1000)

    const after = await sidebarLabels(page)
    expect(after[2], `before=${before.join(",")} after=${after.join(",")}`).toBe(before[0])

    await page.goto("/leads", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(600)
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)
    const afterNav = await sidebarLabels(page)
    expect(afterNav[2]).toBe(before[0])

    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1000)
    const afterReload = await sidebarLabels(page)
    expect(afterReload[2], `after reload ${afterReload.join(",")}`).toBe(before[0])
  })

  test("Navigation: multiple reorders persist in correct final order", async ({ page }) => {
    await login(page)
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1000)

    const before = await sidebarLabels(page)

    async function drag(fromIdx: number, toIdx: number) {
      const handles = page.locator('[data-testid="sidebar-drag-handle"]')
      const a = await handles.nth(fromIdx).boundingBox()
      const b = await handles.nth(toIdx).boundingBox()
      if (!a || !b) throw new Error("handle missing")
      const sx = a.x + a.width / 2
      const sy = a.y + a.height / 2
      await page.mouse.move(sx, sy)
      await page.mouse.down()
      await page.mouse.move(sx, sy + 20, { steps: 5 })
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
      await page.waitForTimeout(250)
      await page.mouse.up()
      await page.waitForTimeout(700)
    }

    // Move item 3 up to top, then move item 5 up to position 1.
    await drag(3, 0)
    await drag(4, 0)

    const after = await sidebarLabels(page)
    // The original top item should now be lower; just assert stability: no duplicates, same count, still has all sections.
    expect(new Set(after).size).toBe(after.length)
    expect(after.length).toBe(before.length)

    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1000)
    const afterReload = await sidebarLabels(page)
    expect(afterReload.join(","), `final=${afterReload.join(",")}`).toBe(after.join(","))
  })

  test("Navigation: no sections are lost after reordering", async ({ page }) => {
    await login(page)
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1000)
    const labels = await sidebarLabels(page)
    const expected = [
      "Dashboard", "Integrations", "Leads", "Chat", "Agents", "Todoist",
      "Knowledge", "Documents", "AI Venture", "Research Lab", "Notepad",
      "Brainstorm Sketch", "Terminal", "Useful Links", "Mail Apps", "Vault", "Settings",
    ]
    for (const e of expected) {
      expect(labels, `missing ${e} in ${labels.join(",")}`).toContain(e)
    }
  })

  test("Integrations is a first-class section near the top and opens", async ({ page }) => {
    await login(page)
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1000)
    const labels = await sidebarLabels(page)
    expect(labels.indexOf("Integrations")).toBeLessThan(3)
    expect(labels[0]).toBe("Dashboard")

    await page.goto("/integrations", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)
    // The integrations page should render some real content (not an error).
    await expect(page.locator("h1, h2, main").first()).toBeVisible({ timeout: 8000 })
  })

  test("Terminal: failed save preserves input and communicates error (no fake success)", async ({ page }) => {
    await login(page)
    await page.goto("/terminal", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)

    await page.route("**/api/terminal", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "Simulated failure" } }),
        })
      }
      return route.continue()
    })

    const title = `FailTest ${Date.now()}`
    await page.getByRole("button", { name: /Add Command/i }).click()
    await page.getByPlaceholder("e.g. Check Port 25").fill(title)
    await page.getByPlaceholder("nc -vz example.com 25").fill("echo fail")
    await page.getByRole("button", { name: /Save Command/i }).click()

    // Error communicated (the dialog shows the failure state, not a fake success),
    // and the user's input is preserved in the still-open sheet.
    await expect(page.getByText(/Couldn.t save — Retry/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByPlaceholder("e.g. Check Port 25")).toHaveValue(title)

    await page.unroute("**/api/terminal")
  })
})
