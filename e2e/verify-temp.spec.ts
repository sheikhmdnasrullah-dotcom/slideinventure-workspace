import { test, type Page } from "@playwright/test"

const EMAIL = process.env.AI_EMAIL || "tanimsyt@gmail.com"
const PASSWORD = process.env.AI_PASSWORD || "Trimtales@2026"

async function login(page: Page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto("/login", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(400)
    await page.fill('input[id="email"]', EMAIL)
    await page.fill('input[id="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    try {
      await page.waitForURL((url) => url.pathname !== "/login", { timeout: 20000 })
      return
    } catch {
      // retry
    }
  }
  throw new Error("Login failed")
}

test("global search + command menu", async ({ page }) => {
  test.setTimeout(150000)
  const logs: string[] = []
  page.on("console", (m) => logs.push(`CONSOLE:${m.type()}:${m.text()}`))
  page.on("requestfailed", (r) => logs.push(`REQFAIL:${r.url()}:${r.failure()?.errorText}`))
  page.on("response", (r) => { if (r.url().includes("/api/search")) logs.push(`SRCH_RESP:${r.status()}`) })

  await login(page)

  const token = `ZebraTok${Date.now()}`
  const post = await page.request.post("/api/links", { data: { url: `https://example.com/${token}`, title: token } })
  const linkId = (await post.json()).id as string

  await page.keyboard.press("Meta+k")
  await page.waitForTimeout(500)
  const dialogCount = await page.locator('[aria-label="Command menu"]').count()
  console.log("DIALOG_COUNT", dialogCount)

  const input = page.locator('input[aria-label="Command input"]')
  const inputCount = await input.count()
  console.log("INPUT_COUNT", inputCount)
  if (inputCount > 0) {
    await input.fill("zebra")
    await page.waitForTimeout(1000)
  }
  const resultBtns = await page.locator('button[role="option"]').count()
  console.log("OPTION_COUNT", resultBtns)
  const tokenVisible = await page.locator(`button:has-text("${token}")`).first().isVisible().catch(() => false)
  console.log("TOKEN_VISIBLE", tokenVisible)

  console.log(logs.join("\n"))

  if (linkId) await page.request.delete(`/api/links/${linkId}`)
})
