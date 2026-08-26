import { test } from "@playwright/test"
const BASE = "http://localhost:3000"
async function login(page: any) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', "tanimsyt@gmail.com")
  await page.fill('input[type="password"]', "Trimtales@2026")
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== "/login", { timeout: 15000 })
}
test("dbg mount", async ({ page }) => {
  test.setTimeout(150000)
  const logs: string[] = []
  page.on("console", (m: any) => logs.push(`[${m.type()}] ${m.text()}`))
  page.on("pageerror", (e: any) => logs.push(`[pageerror] ${e.message}`))
  await login(page)
  const post = await page.request.post(`${BASE}/api/affine`, { data: { section: "brainstorm", title: "XMOUNT" } })
  const id = (await post.json()).workspace?.id
  console.log("ID", id)
  await page.goto(`${BASE}/brainstorm-sketch`)
  await page.getByText("XMOUNT", { exact: true }).first().click()
  await page.waitForTimeout(12000)
  const editorCount = await page.locator("affine-editor-container").count()
  const errB = await page.getByText("This section hit a problem").count()
  console.log("EDITOR_COUNT", editorCount, "ERR_BOUNDARY", errB)
  console.log("LOGS:\n" + logs.filter(l => l.includes("error") || l.includes("pageerror")).slice(0, 12).join("\n"))
  await page.request.delete(`${BASE}/api/affine/${id}`)
})
