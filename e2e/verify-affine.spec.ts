import { test, expect } from "@playwright/test"
const BASE = "http://localhost:3000"
async function login(page: any) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', "tanimsyt@gmail.com")
  await page.fill('input[type="password"]', "Trimtales@2026")
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== "/login", { timeout: 15000 })
}
async function gotoRetry(page: any, path: string) {
  for (let i = 0; i < 3; i++) {
    try { await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 }); return true }
    catch (e) { if (String(e).includes("ERR_ABORTED")) { await page.waitForTimeout(2500); continue } throw e }
  }
  return false
}
test("editor mounts after opening a workspace (research=edgeless, concepts=page)", async ({ page }) => {
  test.setTimeout(240000)
  await login(page)
  const errs: string[] = []
  page.on("console", (m: any) => { if (m.type() === "error") errs.push(m.text()) })
  page.on("pageerror", (e: any) => errs.push("[pageerror] " + e.message))

  // RESEARCH (edgeless)
  await gotoRetry(page, "/research-lab")
  await page.getByRole("button", { name: /new/i }).first().click()
  let rOk = true
  try { await page.waitForSelector("affine-editor-container", { timeout: 90000 }); } catch { rOk = false }
  const rEd = await page.locator("affine-editor-container").count()
  console.log("RESEARCH mounted", rOk, "edCount", rEd)

  // CONCEPTS (page)
  await gotoRetry(page, "/concepts")
  await page.getByRole("button", { name: /new/i }).first().click()
  let cOk = true
  try { await page.waitForSelector("affine-editor-container", { timeout: 90000 }); } catch { cOk = false }
  const cEd = await page.locator("affine-editor-container").count()
  console.log("CONCEPTS mounted", cOk, "edCount", cEd)

  const rel = errs.filter((e) => /block|affine|editor|surface|hydrat/i.test(e))
  console.log("REL_ERRORS", rel.length, JSON.stringify(rel.slice(0, 6)))
})
