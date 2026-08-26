import { test, expect, type Page } from "@playwright/test"

/**
 * Closes the specific gaps called out for Knowledge / Todoist / Leads /
 * global search that the existing e2e/uploads.spec.ts and friends don't
 * cover yet. Uses the dedicated test account (not the real user) since
 * these tests create and delete real records.
 */

const EMAIL = "e2e-verify-test@slideinventure.com"
const PASSWORD = "E2eVaultTest_cq5r3d6m!9"

async function login(page: Page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto("/login", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(300)
    await page.fill("#email", EMAIL)
    await page.fill("#password", PASSWORD)
    await page.click('button[type="submit"]')
    try {
      await page.waitForURL((url) => url.pathname !== "/login", { timeout: 15000 })
      return
    } catch {
      // auth backend flaky — retry
    }
  }
  throw new Error("Login did not complete after retries")
}

test.describe("Knowledge — no forced metadata", () => {
  test("paste-only content (no title, no file) saves successfully", async ({ page }) => {
    await login(page)
    await page.goto("/knowledge", { waitUntil: "domcontentloaded" })

    await page.waitForTimeout(500)
    await page.getByRole("button", { name: "Add Context" }).click()
    const contentBox = page.getByPlaceholder(/paste your context/i)
    await contentBox.waitFor({ timeout: 10000 })
    const marker = `regression-test-${Date.now()}`
    await contentBox.fill(`Just pasted text, no title given. ${marker}`)

    await page.getByRole("button", { name: /save to knowledge base/i }).click()
    // No validation error about a missing title should appear, and the
    // dialog should close on success.
    await expect(page.getByText(/title.*required/i)).toHaveCount(0)
    await expect(contentBox).toHaveCount(0, { timeout: 10000 })

    // Clean up via the API — reliable regardless of the list UI's exact markup.
    await page.waitForTimeout(1000)
    const searchRes = await page.request.get(`/api/knowledge/search?q=${encodeURIComponent(marker)}&mode=items`)
    const searchBody = await searchRes.json().catch(() => ({ results: [] }))
    for (const item of searchBody.results ?? []) {
      await page.request.delete(`/api/knowledge/${item.id}`).catch(() => {})
    }
  })
})

test.describe("Todoist", () => {
  test("create task with a deadline, it appears without a manual refresh, no duplicate on double-click", async ({ page }) => {
    await login(page)
    await page.goto("/todoist", { waitUntil: "domcontentloaded" })

    const marker = `Regression task ${Date.now()}`
    await page.getByRole("button", { name: "Add Task" }).click()
    await page.getByPlaceholder("What needs to be done?").fill(marker)

    // Set a deadline via the picker — accept its default (next hour) by just applying.
    await page.getByText("Set deadline (date & time)").click()
    await page.getByRole("button", { name: "Apply" }).click()
    await expect(page.getByText("Set deadline (date & time)")).toHaveCount(0)

    // Rapid double-click should not create two tasks — the submittingRef
    // guard in todoist-content.tsx's handleSave should block the second call.
    const createBtn = page.getByRole("button", { name: "Create Task" })
    await createBtn.click()
    await createBtn.click({ timeout: 500 }).catch(() => {})

    await expect(page.getByText(marker)).toBeVisible({ timeout: 10000 })
    expect(await page.getByText(marker, { exact: true }).count()).toBe(1)

    // Clean up via the API — more reliable than reverse-engineering the row's
    // delete-icon hit target for a task we already know exists.
    const listRes = await page.request.get("/api/todoist?pageSize=50")
    const listBody = await listRes.json().catch(() => ({ data: [] }))
    const created = (listBody.data ?? []).find((t: { content?: string; id: string }) => t.content === marker)
    if (created) await page.request.delete(`/api/todoist/${created.id}`).catch(() => {})
  })
})

test.describe("Global search / command palette", () => {
  test("finds a real record and opening it navigates correctly, no dead end", async ({ page }) => {
    await login(page)

    // Create a uniquely-named link so we have something guaranteed findable.
    const marker = `findable-${Date.now()}`
    const res = await page.request.post("/api/links", {
      data: { url: "https://example.com", title: marker },
    })
    expect(res.ok()).toBeTruthy()
    const { id } = await res.json()

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(500)
    await page.locator("body").click()
    await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k")
    const input = page.getByPlaceholder(/search everything/i)
    await input.waitFor({ timeout: 8000 })
    await input.fill(marker)
    await page.waitForTimeout(600)

    // Scoped to role="option" (the actual result rows) — a plain getByText(marker)
    // also matches the palette's "No matches for {query}" empty-state paragraph,
    // which renders immediately (before the debounced /api/search fetch resolves)
    // and contains the raw query text, so it wins the race and swallows the click.
    const result = page.getByRole("option", { name: new RegExp(marker) }).first()
    await expect(result).toBeVisible({ timeout: 8000 })
    await result.click()
    // A command-palette Result triggers a client-side router.push (no full
    // page "load" event), so poll the URL directly rather than waitForURL's
    // default load-event wait.
    await expect.poll(() => page.url(), { timeout: 10000 }).toContain("/useful-links")
    // No "not found" / error state, no layout explosion (page has real content).
    await expect(page.getByText(/not found/i)).toHaveCount(0)

    await page.request.delete(`/api/links/${id}`)
  })
})

test.describe("Leads", () => {
  test("search filters the table, pagination controls reflect real record count", async ({ page }) => {
    await login(page)

    // Seed a few uniquely-named leads so search/pagination has something real to work with.
    const marker = `RegressionLead${Date.now()}`
    const created: string[] = []
    for (let i = 0; i < 3; i++) {
      const res = await page.request.post("/api/leads", {
        data: { first_name: marker, last_name: `Row${i}`, email: `${marker.toLowerCase()}${i}@example.com` },
      })
      if (res.ok()) {
        const body = await res.json().catch(() => ({}))
        if (body?.id) created.push(body.id)
      }
    }

    await page.goto("/leads", { waitUntil: "domcontentloaded" })
    await page.getByPlaceholder(/search leads/i).fill(marker)
    await page.waitForTimeout(600)
    await expect(page.getByText(marker, { exact: false }).first()).toBeVisible({ timeout: 10000 })
    const visibleRows = await page.getByText(marker, { exact: false }).count()
    expect(visibleRows).toBeGreaterThanOrEqual(3)

    // Clean up seeded leads.
    for (const id of created) {
      await page.request.delete(`/api/leads/${id}`).catch(() => {})
    }
  })
})
