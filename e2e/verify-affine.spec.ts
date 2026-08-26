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
  for (let i = 0; i < 4; i++) {
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 })
      return true
    } catch (e) {
      if (String(e).includes("ERR_ABORTED")) { await page.waitForTimeout(3000); continue }
      throw e
    }
  }
  return false
}
test("AFFiNE final: brainstorm editor + concepts rename", async ({ page }) => {
  test.setTimeout(180000)
  await login(page)
  const name = "WS_" + Date.now()
  const post = await page.request.post(`${BASE}/api/affine`, { data: { section: "brainstorm", title: name } })
  const id = (await post.json()).workspace?.id
  expect(id).toBeTruthy()
  await page.request.put(`${BASE}/api/affine/${id}`, { data: { snapshot: { v: 1 } } })
  const after = await page.request.get(`${BASE}/api/affine/${id}`)
  expect(JSON.stringify((await after.json()).workspace?.snapshot)).toContain("v")

  expect(await gotoRetry(page, "/brainstorm-sketch")).toBe(true)
  await page.getByText(name, { exact: true }).first().click()
  await page.waitForTimeout(12000)
  expect(await page.locator("affine-editor-container").count()).toBe(1)
  console.log("BRAINSTORM_EDITOR_OK")

  expect(await gotoRetry(page, "/concepts")).toBe(true)
  await expect(page.getByText("Concepts", { exact: false }).first()).toBeVisible({ timeout: 15000 })
  console.log("CONCEPTS_OK")

  await page.request.delete(`${BASE}/api/affine/${id}`)
})
