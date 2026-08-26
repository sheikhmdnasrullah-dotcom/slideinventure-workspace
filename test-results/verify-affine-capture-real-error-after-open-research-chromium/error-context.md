# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: verify-affine.spec.ts >> capture real error after open research
- Location: e2e/verify-affine.spec.ts:10:5

# Error details

```
Error: page.goto: net::ERR_ABORTED at http://localhost:3000/research-lab
Call log:
  - navigating to "http://localhost:3000/research-lab", waiting until "load"

```

# Page snapshot

```yaml
- generic [active] [ref=f4e1]:
  - generic [ref=f4e2]:
    - generic [ref=f4e5]:
      - list [ref=f4e7]:
        - listitem [ref=f4e8]:
          - button "SV SlideIn Venture Ops console" [ref=f4e9]:
            - generic [ref=f4e10]: SV
            - generic [ref=f4e11]:
              - generic [ref=f4e12]: SlideIn Venture
              - generic [ref=f4e13]: Ops console
      - generic [ref=f4e15]:
        - generic [ref=f4e16]: Workspace
        - generic [ref=f4e17]:
          - list [ref=f4e18]:
            - listitem [ref=f4e19]:
              - generic [ref=f4e21]:
                - button "Drag Dashboard" [ref=f4e22]
                - button "Dashboard" [ref=f4e24]
            - listitem [ref=f4e31]:
              - generic [ref=f4e33]:
                - button "Drag Leads" [ref=f4e34]
                - generic [ref=f4e37]:
                  - button "Leads" [ref=f4e38]
                  - button "Toggle Leads submenu" [ref=f4e43]
            - listitem [ref=f4e46]:
              - generic [ref=f4e48]:
                - button "Drag Chat" [ref=f4e49]
                - button "Chat" [ref=f4e51]
            - listitem [ref=f4e55]:
              - generic [ref=f4e57]:
                - button "Drag Agents" [ref=f4e58]
                - button "Agents" [ref=f4e60]
            - listitem [ref=f4e65]:
              - generic [ref=f4e67]:
                - button "Drag Documents" [ref=f4e68]
                - button "Documents" [ref=f4e70]
            - listitem [ref=f4e75]:
              - generic [ref=f4e77]:
                - button "Drag Integrations" [ref=f4e78]
                - button "Integrations" [ref=f4e80]
            - listitem [ref=f4e86]:
              - generic [ref=f4e88]:
                - button "Drag Todoist" [ref=f4e89]
                - button "Todoist" [ref=f4e91]
            - listitem [ref=f4e96]:
              - generic [ref=f4e98]:
                - button "Drag Knowledge" [ref=f4e99]
                - button "Knowledge" [ref=f4e101]
            - listitem [ref=f4e105]:
              - generic [ref=f4e107]:
                - button "Drag Research Lab" [ref=f4e108]
                - button "Research Lab" [ref=f4e110]
            - listitem [ref=f4e114]:
              - generic [ref=f4e116]:
                - button "Drag AI Venture" [ref=f4e117]
                - button "AI Venture" [ref=f4e119]
            - listitem [ref=f4e126]:
              - generic [ref=f4e128]:
                - button "Drag Notepad" [ref=f4e129]
                - button "Notepad" [ref=f4e131]
            - listitem [ref=f4e135]:
              - generic [ref=f4e137]:
                - button "Drag Brainstorm Sketch" [ref=f4e138]
                - button "Brainstorm Sketch" [ref=f4e140]
            - listitem [ref=f4e150]:
              - generic [ref=f4e152]:
                - button "Drag Terminal" [ref=f4e153]
                - button "Terminal" [ref=f4e155]
            - listitem [ref=f4e159]:
              - generic [ref=f4e161]:
                - button "Drag Useful Links" [ref=f4e162]
                - button "Useful Links" [ref=f4e164]
            - listitem [ref=f4e169]:
              - generic [ref=f4e171]:
                - button "Drag Mail Apps" [ref=f4e172]
                - generic [ref=f4e175]:
                  - button "Mail Apps" [ref=f4e176]
                  - button "Toggle Mail Apps submenu" [ref=f4e181]
            - listitem [ref=f4e184]:
              - generic [ref=f4e186]:
                - button "Drag Vault" [ref=f4e187]
                - button "Vault" [ref=f4e189]
            - listitem [ref=f4e202]:
              - generic [ref=f4e204]:
                - button "Drag Settings" [ref=f4e205]
                - button "Settings" [ref=f4e207]
          - status [ref=f4e212]
      - generic [ref=f4e213]:
        - generic [ref=f4e214]: Workspace remembers your layout
        - list [ref=f4e215]:
          - listitem [ref=f4e216]:
            - button "TA tanimsyt tanimsyt@gmail.com" [ref=f4e217]:
              - generic [ref=f4e218]: TA
              - generic [ref=f4e220]:
                - generic [ref=f4e221]: tanimsyt
                - generic [ref=f4e222]: tanimsyt@gmail.com
    - main [ref=f4e226]:
      - generic [ref=f4e227]:
        - generic [ref=f4e229]:
          - button "Toggle Sidebar" [ref=f4e230]
          - separator [ref=f4e232]
          - navigation "breadcrumb" [ref=f4e233]:
            - list [ref=f4e234]:
              - listitem [ref=f4e235]:
                - link "Dashboard" [disabled] [ref=f4e236]
          - generic [ref=f4e237]:
            - button "Open command menu" [ref=f4e238]:
              - generic [ref=f4e239]: Ask · Search
              - generic [ref=f4e240]: ⌘K
            - generic [ref=f4e241]: Aug 1 – Aug 21, 2026
        - generic [ref=f4e244]:
          - generic [ref=f4e246]:
            - heading "Command Center" [level=1] [ref=f4e247]
            - paragraph [ref=f4e248]: Live workspace overview • Updated just now
          - generic [ref=f4e250]:
            - generic [ref=f4e251]:
              - generic [ref=f4e252]: Outreach velocity
              - generic [ref=f4e253]: Emails sent over the last 3 months
              - tablist [ref=f4e257]:
                - tab "Last 3 months" [selected] [ref=f4e258]
                - tab "Last 30 days" [ref=f4e259]
                - tab "Last 7 days" [ref=f4e260]
            - application [ref=f4e265]
          - generic [ref=f4e269]:
            - generic [ref=f4e271]:
              - generic [ref=f4e272]:
                - generic [ref=f4e273]: Live Activity
                - generic [ref=f4e274]: Automatic activity from every module
              - paragraph [ref=f4e276]: No recent activity. Start working in any module to see live updates here.
            - generic [ref=f4e278]:
              - generic [ref=f4e289]:
                - generic [ref=f4e290]: Concepts
                - generic [ref=f4e291]: Recent research activity
              - button [ref=f4e293]:
                - link "Open Concepts" [ref=f4e294] [cursor=pointer]:
                  - /url: /concepts
            - generic [ref=f4e296]:
              - generic [ref=f4e301]:
                - generic [ref=f4e302]: Terminal
                - generic [ref=f4e303]: Recent findings
              - button [ref=f4e305]:
                - link "Open Terminal" [ref=f4e306] [cursor=pointer]:
                  - /url: /terminal
            - generic [ref=f4e308]:
              - generic [ref=f4e313]:
                - generic [ref=f4e314]: Knowledge
                - generic [ref=f4e315]: Recently updated
              - button [ref=f4e317]:
                - link "Open Knowledge" [ref=f4e318] [cursor=pointer]:
                  - /url: /knowledge
            - generic [ref=f4e320]:
              - generic [ref=f4e328]:
                - generic [ref=f4e329]: Leads
                - generic [ref=f4e330]: Active prospects
              - button [ref=f4e332]:
                - link "Open Leads" [ref=f4e333] [cursor=pointer]:
                  - /url: /leads
            - generic [ref=f4e335]:
              - generic [ref=f4e341]:
                - generic [ref=f4e342]: Documents
                - generic [ref=f4e343]: Recently created
              - button [ref=f4e345]:
                - link "Open Documents" [ref=f4e346] [cursor=pointer]:
                  - /url: /documents
            - generic [ref=f4e348]:
              - generic [ref=f4e353]:
                - generic [ref=f4e354]: Chat
                - generic [ref=f4e355]: Recent conversations
              - button [ref=f4e357]:
                - link "Open Chat" [ref=f4e358] [cursor=pointer]:
                  - /url: /chat
          - generic [ref=f4e360]:
            - generic [ref=f4e361]:
              - generic [ref=f4e362]: All Activity
              - generic [ref=f4e363]: Unified timeline from all modules
            - generic [ref=f4e365]:
              - generic [ref=f4e366]:
                - generic [ref=f4e367]: View
                - combobox "View" [ref=f4e368]:
                  - option "Outline" [selected]
                  - option "Past Performance"
                  - option "Key Personnel"
                  - option "Focus Documents"
                - generic [ref=f4e369]:
                  - button "Customize Columns" [ref=f4e370]
                  - button "Add Section" [ref=f4e372]
              - tabpanel "Outline" [ref=f4e374]:
                - generic [ref=f4e375]:
                  - table [ref=f4e377]:
                    - rowgroup [ref=f4e378]:
                      - row [ref=f4e379]:
                        - columnheader [ref=f4e380]
                        - columnheader [ref=f4e381]:
                          - generic [ref=f4e382]:
                            - checkbox "Select all" [ref=f4e383]
                            - checkbox [ref=f4e384]
                        - columnheader "Item" [ref=f4e385]
                        - columnheader "Type" [ref=f4e386]
                        - columnheader "Status" [ref=f4e387]
                        - columnheader "Target" [ref=f4e388]
                        - columnheader "Limit" [ref=f4e390]
                        - columnheader "Reviewer" [ref=f4e392]
                        - columnheader [ref=f4e393]
                    - rowgroup [ref=f4e394]:
                      - row [ref=f4e395]:
                        - cell "No results." [ref=f4e396]
                  - status [ref=f4e397]
                - generic [ref=f4e398]:
                  - generic [ref=f4e399]: 0 of 0 row(s) selected.
                  - generic [ref=f4e400]:
                    - generic [ref=f4e401]:
                      - generic [ref=f4e402]: Rows per page
                      - combobox "Rows per page" [ref=f4e403]:
                        - option "10" [selected]
                        - option "20"
                        - option "30"
                        - option "40"
                        - option "50"
                    - generic [ref=f4e404]: Page 1 of 0
                    - generic [ref=f4e405]:
                      - button "Go to first page" [disabled]
                      - button "Go to previous page" [disabled]
                      - button "Go to next page" [disabled]
                      - button "Go to last page" [disabled]
    - region "Notifications alt+T"
  - generic [ref=f4e410] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=f4e411]
    - generic [ref=f4e415]:
      - button "Open issues overlay" [ref=f4e416]:
        - generic [ref=f4e417]:
          - generic [ref=f4e418]: "1"
          - generic [ref=f4e419]: "2"
        - generic [ref=f4e420]:
          - text: Issue
          - generic [ref=f4e421]: s
      - button "Collapse issues badge" [ref=f4e422]
  - alert [ref=f4e425]
```

# Test source

```ts
  1  | import { test } from "@playwright/test"
  2  | const BASE = "http://localhost:3000"
  3  | async function login(page: any) {
  4  |   await page.goto(`${BASE}/login`)
  5  |   await page.fill('input[type="email"]', "tanimsyt@gmail.com")
  6  |   await page.fill('input[type="password"]', "Trimtales@2026")
  7  |   await page.click('button[type="submit"]')
  8  |   await page.waitForFunction(() => location.pathname !== "/login", { timeout: 15000 })
  9  | }
  10 | test("capture real error after open research", async ({ page }) => {
  11 |   test.setTimeout(120000)
  12 |   await login(page)
  13 |   const errs: string[] = []
  14 |   page.on("console", (m: any) => { if (m.type() === "error") errs.push(m.text()) })
  15 |   page.on("pageerror", (e: any) => errs.push("[pageerror] " + e.message))
> 16 |   await page.goto(`${BASE}/research-lab`)
     |              ^ Error: page.goto: net::ERR_ABORTED at http://localhost:3000/research-lab
  17 |   await page.getByRole("button", { name: /new/i }).first().click()
  18 |   await page.waitForTimeout(12000)
  19 |   const real = errs.filter((e) => !/hydrat|aria-describedby|asChild|aschild/i.test(e))
  20 |   real.forEach((e,i)=>console.log(`REAL${i}:`, e.slice(0,500)))
  21 |   console.log("REAL_COUNT", real.length)
  22 | })
  23 | 
```