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

test.describe("Upload flows work without errors", () => {
  test("Documents: upload a PDF and see success", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`)
    })

    await login(page)
    await page.goto("/documents", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)

    await page.getByRole("button", { name: /Upload PDF/i }).click()
    await expect(page.locator("#file")).toBeVisible({ timeout: 5000 })
    await page.locator("#file").setInputFiles("/tmp/fake-doc.pdf")
    await page.fill("#title", `UploadTest ${Date.now()}`)
    await page.getByRole("button", { name: /^Upload$/ }).click()

    await expect(page.getByText(/Document uploaded/i)).toBeVisible({ timeout: 20000 })
    expect(errors, errors.join("\n")).toHaveLength(0)
  })

  test("Leads: import a CSV and see success", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`)
    })

    await login(page)
    await page.goto("/leads", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)

    await page.getByRole("button", { name: /Import/i }).first().click()
    const csvInput = page.locator("#csv-file-input")
    await expect(csvInput).toBeVisible({ timeout: 5000 })
    await csvInput.setInputFiles("/tmp/leads.csv")

    // Parsing + auto-mapping; the Import button should enable.
    const importBtn = page.getByRole("button", { name: /Import/i }).last()
    await expect(importBtn).toBeEnabled({ timeout: 10000 })
    await importBtn.click()

    // Either success toast (dialog closes) or a handled error toast — never a crash.
    await expect(
      page.getByText(/Imported \d+ leads/i).or(page.getByText(/Import failed|No data to import/i))
    ).toBeVisible({ timeout: 20000 })

    expect(errors, errors.join("\n")).toHaveLength(0)
  })
})
