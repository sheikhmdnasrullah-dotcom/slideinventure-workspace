import { test } from "@playwright/test"
const BASE = "http://localhost:3000"
async function login(page: any) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', "tanimsyt@gmail.com")
  await page.fill('input[type="password"]', "Trimtales@2026")
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== "/login", { timeout: 15000 })
}
test("capture real error after open research", async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  const errs: string[] = []
  page.on("console", (m: any) => { if (m.type() === "error") errs.push(m.text()) })
  page.on("pageerror", (e: any) => errs.push("[pageerror] " + e.message))
  await page.goto(`${BASE}/research-lab`)
  await page.getByRole("button", { name: /new/i }).first().click()
  await page.waitForTimeout(12000)
  const real = errs.filter((e) => !/hydrat|aria-describedby|asChild|aschild/i.test(e))
  real.forEach((e,i)=>console.log(`REAL${i}:`, e.slice(0,500)))
  console.log("REAL_COUNT", real.length)
})
