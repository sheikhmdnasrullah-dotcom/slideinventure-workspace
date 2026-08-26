import { test } from "@playwright/test"
const BASE = "http://localhost:3000"
async function login(page: any) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', "tanimsyt@gmail.com")
  await page.fill('input[type="password"]', "Trimtales@2026")
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== "/login", { timeout: 15000 })
}
test("dbg both", async ({ page }) => {
  test.setTimeout(120000)
  const errs: string[] = []
  page.on("pageerror", (e: any) => errs.push(e.message))
  page.on("console", (m: any) => { if (m.type() === "error") errs.push("CONSOLE:" + m.text()) })
  await login(page)
  for (const path of ["/brainstorm-sketch", "/concepts"]) {
    try {
      const r = await page.goto(`${BASE}${path}`)
      await page.waitForTimeout(3000)
      const t = await page.getByText(path === "/concepts" ? "Concepts" : "Brainstorm", { exact: false }).count()
      console.log(`PATH ${path} STATUS ${r?.status()} URL ${page.url()} TEXT ${t}`)
    } catch (e: any) {
      console.log(`PATH ${path} GOTO_ERR ${String(e).slice(0, 80)}`)
    }
  }
  console.log("ERRS", errs.slice(0, 6))
})
