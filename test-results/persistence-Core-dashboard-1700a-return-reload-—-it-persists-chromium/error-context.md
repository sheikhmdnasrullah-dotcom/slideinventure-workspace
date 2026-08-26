# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: persistence.spec.ts >> Core dashboard persistence >> Vault: save a secret, navigate away, return, reload — it persists
- Location: e2e/persistence.spec.ts:87:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('VaultTest 1787764732694').first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText('VaultTest 1787764732694').first()

```

```yaml
- status
- region "Notifications alt+T":
  - list:
    - listitem: Failed to add secret
- dialog "Add Secret":
  - heading "Add Secret" [level=2]
  - paragraph: Add a new secret to your vault.
  - text: Name
  - textbox "e.g. Production Database": VaultTest 1787764732694
  - text: Service Name
  - textbox "e.g. AWS, GitHub"
  - text: Username
  - textbox "e.g. admin@example.com"
  - text: Category
  - combobox: Select category
  - text: Type
  - combobox: password
  - text: URL
  - textbox "https://example.com"
  - text: Secret Value
  - textbox "Enter the secret value...": super-secret-value
  - text: Tags (comma-separated)
  - textbox "prod, database, aws"
  - text: Notes
  - textbox "Any additional context..."
  - text: Expires At (optional)
  - textbox
  - text: Couldn’t save — Retry
  - button "Save Secret":
    - img
    - text: Save Secret
  - button "Close"
```

# Test source

```ts
  1   | import { test, expect, type Page } from "@playwright/test"
  2   | 
  3   | const EMAIL = process.env.AI_EMAIL || "tanimsyt@gmail.com"
  4   | const PASSWORD = process.env.AI_PASSWORD || "Trimtales@2026"
  5   | 
  6   | async function login(page: Page) {
  7   |   for (let attempt = 0; attempt < 4; attempt += 1) {
  8   |     await page.goto("/login", { waitUntil: "domcontentloaded" })
  9   |     await page.waitForTimeout(500)
  10  |     await page.fill('input[id="email"]', EMAIL)
  11  |     await page.fill('input[id="password"]', PASSWORD)
  12  |     await page.click('button[type="submit"]')
  13  |     try {
  14  |       await page.waitForURL((url) => url.pathname !== "/login", { timeout: 20000 })
  15  |       return
  16  |     } catch {
  17  |       // auth backend flaky — retry
  18  |     }
  19  |   }
  20  |   throw new Error("Login did not complete after retries")
  21  | }
  22  | 
  23  | function sidebarLabels(page: Page) {
  24  |   return page
  25  |     .locator('[data-testid="sidebar-drag-handle"]')
  26  |     .evaluateAll((handles) =>
  27  |       handles.map((h) => (h.getAttribute("aria-label") || "").replace(/^Drag /, ""))
  28  |     )
  29  | }
  30  | 
  31  | async function expandSection(page: Page, name: string) {
  32  |   const btn = page.getByRole("button", { name }).first()
  33  |   // If the section content (e.g. a known control) isn't visible yet, click to expand.
  34  |   await btn.click()
  35  |   await page.waitForTimeout(400)
  36  | }
  37  | 
  38  | test.describe("Core dashboard persistence", () => {
  39  |   test("Terminal: save a command, navigate away, return, reload — it persists", async ({ page }) => {
  40  |     const title = `TermTest ${Date.now()}`
  41  |     await login(page)
  42  |     await page.goto("/terminal", { waitUntil: "domcontentloaded" })
  43  |     await page.waitForTimeout(800)
  44  | 
  45  |     await page.getByRole("button", { name: /Add Command/i }).click()
  46  |     await page.getByPlaceholder("e.g. Check Port 25").fill(title)
  47  |     await page.getByPlaceholder("nc -vz example.com 25").fill("echo hello")
  48  |     await page.getByRole("button", { name: /Save Command/i }).click()
  49  | 
  50  |     await expect(page.getByText(title).first()).toBeVisible({ timeout: 15000 })
  51  | 
  52  |     await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
  53  |     await page.waitForTimeout(500)
  54  |     await page.goto("/terminal", { waitUntil: "domcontentloaded" })
  55  |     await page.waitForTimeout(800)
  56  |     await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 })
  57  | 
  58  |     await page.reload({ waitUntil: "domcontentloaded" })
  59  |     await page.waitForTimeout(1000)
  60  |     await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 })
  61  |   })
  62  | 
  63  |   test("Useful Links: save by URL only (no title), fallback title, persists", async ({ page }) => {
  64  |     const host = `links-test-${Date.now()}.example.com`
  65  |     const url = `https://${host}/page`
  66  |     await login(page)
  67  |     await page.goto("/useful-links", { waitUntil: "domcontentloaded" })
  68  |     await page.waitForTimeout(800)
  69  | 
  70  |     await page.getByRole("button", { name: /Add Link/i }).click()
  71  |     await page.getByPlaceholder("https://google.com").fill(url)
  72  |     await page.getByRole("button", { name: /^Save$/ }).click()
  73  | 
  74  |     await expect(page.getByText(host).first()).toBeVisible({ timeout: 15000 })
  75  | 
  76  |     await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
  77  |     await page.waitForTimeout(500)
  78  |     await page.goto("/useful-links", { waitUntil: "domcontentloaded" })
  79  |     await page.waitForTimeout(800)
  80  |     await expect(page.getByText(host).first()).toBeVisible({ timeout: 10000 })
  81  | 
  82  |     await page.reload({ waitUntil: "domcontentloaded" })
  83  |     await page.waitForTimeout(1000)
  84  |     await expect(page.getByText(host).first()).toBeVisible({ timeout: 10000 })
  85  |   })
  86  | 
  87  |   test("Vault: save a secret, navigate away, return, reload — it persists", async ({ page }) => {
  88  |     const name = `VaultTest ${Date.now()}`
  89  |     await login(page)
  90  |     await page.goto("/vault", { waitUntil: "domcontentloaded" })
  91  |     await page.waitForTimeout(800)
  92  | 
  93  |     await page.getByRole("button", { name: /Add Secret/i }).click()
  94  |     await page.getByPlaceholder("e.g. Production Database").fill(name)
  95  |     await page.getByPlaceholder("Enter the secret value...").fill("super-secret-value")
  96  |     await page.getByRole("button", { name: /Save Secret/i }).click()
  97  | 
> 98  |     await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 })
      |                                                ^ Error: expect(locator).toBeVisible() failed
  99  | 
  100 |     await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
  101 |     await page.waitForTimeout(500)
  102 |     await page.goto("/vault", { waitUntil: "domcontentloaded" })
  103 |     await page.waitForTimeout(800)
  104 |     await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })
  105 | 
  106 |     await page.reload({ waitUntil: "domcontentloaded" })
  107 |     await page.waitForTimeout(1000)
  108 |     await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })
  109 |   })
  110 | 
  111 |   test("Settings: change theme to Dark and it survives refresh", async ({ page }) => {
  112 |     await login(page)
  113 |     await page.goto("/settings", { waitUntil: "domcontentloaded" })
  114 |     await page.waitForTimeout(800)
  115 | 
  116 |     await expandSection(page, "Appearance")
  117 |     await page.locator("#theme").click()
  118 |     await page.getByRole("option", { name: "Dark", exact: true }).click()
  119 |     await page.waitForTimeout(500)
  120 |     const cls1 = await page.evaluate(() => document.documentElement.className)
  121 |     expect(cls1).toContain("dark")
  122 | 
  123 |     await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
  124 |     await page.waitForTimeout(500)
  125 |     await page.goto("/settings", { waitUntil: "domcontentloaded" })
  126 |     await page.waitForTimeout(800)
  127 |     const cls2 = await page.evaluate(() => document.documentElement.className)
  128 |     expect(cls2).toContain("dark")
  129 | 
  130 |     await page.reload({ waitUntil: "domcontentloaded" })
  131 |     await page.waitForTimeout(1000)
  132 |     const cls3 = await page.evaluate(() => document.documentElement.className)
  133 |     expect(cls3).toContain("dark")
  134 | 
  135 |     // Reset to light so we don't pollute shared server state for other tests.
  136 |     await expandSection(page, "Appearance")
  137 |     await page.locator("#theme").click()
  138 |     await page.getByRole("option", { name: "Light", exact: true }).click()
  139 |     await page.waitForTimeout(400)
  140 |   })
  141 | 
  142 |   test("Settings: rename a section and it survives refresh", async ({ page }) => {
  143 |     await login(page)
  144 |     await page.goto("/settings", { waitUntil: "domcontentloaded" })
  145 |     await page.waitForTimeout(800)
  146 | 
  147 |     const renamed = `ZZ ${Date.now()}`
  148 |     await expandSection(page, "Section names")
  149 |     const input = page.getByLabel("Rename Brainstorm Sketch")
  150 |     try {
  151 |       await input.fill(renamed)
  152 |       await page.waitForTimeout(800)
  153 | 
  154 |       await page.reload({ waitUntil: "domcontentloaded" })
  155 |       await page.waitForTimeout(1000)
  156 |       await expect(page.locator(`text=${renamed}`).first()).toBeVisible({ timeout: 5000 })
  157 |     } finally {
  158 |       // restore original name so shared server state is not polluted
  159 |       await expandSection(page, "Section names")
  160 |       await page.getByLabel("Rename Brainstorm Sketch").fill("Brainstorm Sketch")
  161 |       await page.waitForTimeout(600)
  162 |     }
  163 |   })
  164 | 
  165 |   test("Navigation: drag a section up, and order persists across refresh", async ({ page }) => {
  166 |     await login(page)
  167 |     await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
  168 |     await page.waitForTimeout(1000)
  169 | 
  170 |     const before = await sidebarLabels(page)
  171 |     expect(before.length).toBeGreaterThan(3)
  172 | 
  173 |     const handles = page.locator('[data-testid="sidebar-drag-handle"]')
  174 |     const h0 = await handles.nth(0).boundingBox()
  175 |     const h2 = await handles.nth(2).boundingBox()
  176 |     if (!h0 || !h2) throw new Error("drag handles not found")
  177 | 
  178 |     const startX = h0.x + h0.width / 2
  179 |     const startY = h0.y + h0.height / 2
  180 |     await page.mouse.move(startX, startY)
  181 |     await page.mouse.down()
  182 |     await page.mouse.move(startX, startY + 20, { steps: 5 })
  183 |     await page.mouse.move(h2.x + h2.width / 2, h2.y + h2.height / 2, { steps: 12 })
  184 |     await page.waitForTimeout(300)
  185 |     await page.mouse.up()
  186 |     await page.waitForTimeout(1000)
  187 | 
  188 |     const after = await sidebarLabels(page)
  189 |     expect(after[2], `before=${before.join(",")} after=${after.join(",")}`).toBe(before[0])
  190 | 
  191 |     await page.goto("/leads", { waitUntil: "domcontentloaded" })
  192 |     await page.waitForTimeout(600)
  193 |     await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
  194 |     await page.waitForTimeout(800)
  195 |     const afterNav = await sidebarLabels(page)
  196 |     expect(afterNav[2]).toBe(before[0])
  197 | 
  198 |     await page.reload({ waitUntil: "domcontentloaded" })
```