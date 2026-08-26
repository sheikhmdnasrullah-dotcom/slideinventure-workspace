# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: verify-affine.spec.ts >> AFFiNE final: brainstorm editor + concepts rename
- Location: e2e/verify-affine.spec.ts:22:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Concepts')
Expected: visible
Error: strict mode violation: getByText('Concepts') resolved to 2 elements:
    1) <span class="text-sm font-medium">Concepts</span> aka getByText('Concepts', { exact: true })
    2) <p class="text-sm">…</p> aka getByText('Select or create a concepts')

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText('Concepts')

```

# Page snapshot

```yaml
- generic [active] [ref=f8e1]:
  - generic [ref=f8e2]:
    - generic [ref=f8e5]:
      - list [ref=f8e7]:
        - listitem [ref=f8e8]:
          - button "SV SlideIn Venture Ops console" [ref=f8e9]:
            - generic [ref=f8e10]: SV
            - generic [ref=f8e11]:
              - generic [ref=f8e12]: SlideIn Venture
              - generic [ref=f8e13]: Ops console
      - generic [ref=f8e15]:
        - generic [ref=f8e16]: Workspace
        - list [ref=f8e18]:
          - listitem [ref=f8e19]:
            - generic [ref=f8e21]:
              - button "Drag Dashboard" [ref=f8e22]
              - button "Dashboard" [ref=f8e24]
          - listitem [ref=f8e31]:
            - generic [ref=f8e33]:
              - button "Drag Leads" [ref=f8e34]
              - generic [ref=f8e37]:
                - button "Leads" [ref=f8e38]
                - button "Toggle Leads submenu" [ref=f8e43]
          - listitem [ref=f8e46]:
            - generic [ref=f8e48]:
              - button "Drag Chat" [ref=f8e49]
              - button "Chat" [ref=f8e51]
          - listitem [ref=f8e55]:
            - generic [ref=f8e57]:
              - button "Drag Agents" [ref=f8e58]
              - button "Agents" [ref=f8e60]
          - listitem [ref=f8e65]:
            - generic [ref=f8e67]:
              - button "Drag Documents" [ref=f8e68]
              - button "Documents" [ref=f8e70]
          - listitem [ref=f8e75]:
            - generic [ref=f8e77]:
              - button "Drag Integrations" [ref=f8e78]
              - button "Integrations" [ref=f8e80]
          - listitem [ref=f8e86]:
            - generic [ref=f8e88]:
              - button "Drag Todoist" [ref=f8e89]
              - button "Todoist" [ref=f8e91]
          - listitem [ref=f8e96]:
            - generic [ref=f8e98]:
              - button "Drag Knowledge" [ref=f8e99]
              - button "Knowledge" [ref=f8e101]
          - listitem [ref=f8e105]:
            - generic [ref=f8e107]:
              - button "Drag Research Lab" [ref=f8e108]
              - button "Research Lab" [ref=f8e110]
          - listitem [ref=f8e114]:
            - generic [ref=f8e116]:
              - button "Drag AI Venture" [ref=f8e117]
              - button "AI Venture" [ref=f8e119]
          - listitem [ref=f8e126]:
            - generic [ref=f8e128]:
              - button "Drag Notepad" [ref=f8e129]
              - button "Notepad" [ref=f8e131]
          - listitem [ref=f8e135]:
            - generic [ref=f8e137]:
              - button "Drag Brainstorm Sketch" [ref=f8e138]
              - button "Brainstorm Sketch" [ref=f8e140]
          - listitem [ref=f8e150]:
            - generic [ref=f8e152]:
              - button "Drag Terminal" [ref=f8e153]
              - button "Terminal" [ref=f8e155]
          - listitem [ref=f8e159]:
            - generic [ref=f8e161]:
              - button "Drag Useful Links" [ref=f8e162]
              - button "Useful Links" [ref=f8e164]
          - listitem [ref=f8e169]:
            - generic [ref=f8e171]:
              - button "Drag Mail Apps" [ref=f8e172]
              - generic [ref=f8e175]:
                - button "Mail Apps" [ref=f8e176]
                - button "Toggle Mail Apps submenu" [ref=f8e181]
          - listitem [ref=f8e184]:
            - generic [ref=f8e186]:
              - button "Drag Vault" [ref=f8e187]
              - button "Vault" [ref=f8e189]
          - listitem [ref=f8e202]:
            - generic [ref=f8e204]:
              - button "Drag Settings" [ref=f8e205]
              - button "Settings" [ref=f8e207]
      - generic [ref=f8e212]:
        - generic [ref=f8e213]: Workspace remembers your layout
        - list [ref=f8e214]:
          - listitem [ref=f8e215]:
            - button "TA tanimsyt tanimsyt@gmail.com" [ref=f8e216]:
              - generic [ref=f8e217]: TA
              - generic [ref=f8e219]:
                - generic [ref=f8e220]: tanimsyt
                - generic [ref=f8e221]: tanimsyt@gmail.com
    - main [ref=f8e225]:
      - generic [ref=f8e227]:
        - complementary [ref=f8e228]:
          - generic [ref=f8e229]:
            - generic [ref=f8e230]: Concepts
            - button "New" [ref=f8e231]
          - paragraph [ref=f8e234]: Loading…
        - main [ref=f8e235]:
          - generic [ref=f8e236]:
            - paragraph [ref=f8e237]: Select or create a concepts to start editing with AFFiNE.
            - button "New Concept" [ref=f8e238]
    - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=f8e245] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test"
  2  | const BASE = "http://localhost:3000"
  3  | async function login(page: any) {
  4  |   await page.goto(`${BASE}/login`)
  5  |   await page.fill('input[type="email"]', "tanimsyt@gmail.com")
  6  |   await page.fill('input[type="password"]', "Trimtales@2026")
  7  |   await page.click('button[type="submit"]')
  8  |   await page.waitForFunction(() => location.pathname !== "/login", { timeout: 15000 })
  9  | }
  10 | async function gotoRetry(page: any, path: string) {
  11 |   for (let i = 0; i < 4; i++) {
  12 |     try {
  13 |       await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 })
  14 |       return true
  15 |     } catch (e) {
  16 |       if (String(e).includes("ERR_ABORTED")) { await page.waitForTimeout(3000); continue }
  17 |       throw e
  18 |     }
  19 |   }
  20 |   return false
  21 | }
  22 | test("AFFiNE final: brainstorm editor + concepts rename", async ({ page }) => {
  23 |   test.setTimeout(180000)
  24 |   await login(page)
  25 |   const name = "WS_" + Date.now()
  26 |   const post = await page.request.post(`${BASE}/api/affine`, { data: { section: "brainstorm", title: name } })
  27 |   const id = (await post.json()).workspace?.id
  28 |   expect(id).toBeTruthy()
  29 |   await page.request.put(`${BASE}/api/affine/${id}`, { data: { snapshot: { v: 1 } } })
  30 |   const after = await page.request.get(`${BASE}/api/affine/${id}`)
  31 |   expect(JSON.stringify((await after.json()).workspace?.snapshot)).toContain("v")
  32 | 
  33 |   expect(await gotoRetry(page, "/brainstorm-sketch")).toBe(true)
  34 |   await page.getByText(name, { exact: true }).first().click()
  35 |   await page.waitForTimeout(12000)
  36 |   expect(await page.locator("affine-editor-container").count()).toBe(1)
  37 |   console.log("BRAINSTORM_EDITOR_OK")
  38 | 
  39 |   expect(await gotoRetry(page, "/concepts")).toBe(true)
> 40 |   await expect(page.getByText("Concepts", { exact: false })).toBeVisible({ timeout: 15000 })
     |                                                              ^ Error: expect(locator).toBeVisible() failed
  41 |   console.log("CONCEPTS_OK")
  42 | 
  43 |   await page.request.delete(`${BASE}/api/affine/${id}`)
  44 | })
  45 | 
```