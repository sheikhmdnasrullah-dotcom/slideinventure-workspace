# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: debug-rename.spec.ts >> debug: rename with fixed code
- Location: e2e/debug-rename.spec.ts:3:5

# Error details

```
Error: locator.innerText: Error: strict mode violation: locator('main') resolved to 2 elements:
    1) <main data-slot="sidebar-inset" class="relative flex w-full flex-1 flex-col bg-background md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2">…</main> aka getByRole('main').filter({ hasText: 'Brainstorm SketchA calm space' })
    2) <main class="flex min-h-0 flex-1 flex-col bg-muted/20">…</main> aka getByRole('main').filter({ hasText: /^New BrainstormSavedMove focus to canvasPage 1100%Get a license for production$/ })

Call log:
  - waiting for locator('main')

```

# Page snapshot

```yaml
- generic [ref=f4e1]:
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
                - button "Drag Integrations" [ref=f4e34]
                - button "Integrations" [ref=f4e36]
            - listitem [ref=f4e42]:
              - generic [ref=f4e44]:
                - button "Drag Leads" [ref=f4e45]
                - generic [ref=f4e48]:
                  - button "Leads" [ref=f4e49]
                  - button "Toggle Leads submenu" [ref=f4e54]
            - listitem [ref=f4e57]:
              - generic [ref=f4e59]:
                - button "Drag Chat" [ref=f4e60]
                - button "Chat" [ref=f4e62]
            - listitem [ref=f4e66]:
              - generic [ref=f4e68]:
                - button "Drag Agents" [ref=f4e69]
                - button "Agents" [ref=f4e71]
            - listitem [ref=f4e76]:
              - generic [ref=f4e78]:
                - button "Drag Todoist" [ref=f4e79]
                - button "Todoist" [ref=f4e81]
            - listitem [ref=f4e86]:
              - generic [ref=f4e88]:
                - button "Drag Knowledge" [ref=f4e89]
                - button "Knowledge" [ref=f4e91]
            - listitem [ref=f4e95]:
              - generic [ref=f4e97]:
                - button "Drag Documents" [ref=f4e98]
                - button "Documents" [ref=f4e100]
            - listitem [ref=f4e105]:
              - generic [ref=f4e107]:
                - button "Drag AI Venture" [ref=f4e108]
                - button "AI Venture" [ref=f4e110]
            - listitem [ref=f4e117]:
              - generic [ref=f4e119]:
                - button "Drag Notepad" [ref=f4e120]
                - button "Notepad" [ref=f4e122]
            - listitem [ref=f4e126]:
              - generic [ref=f4e128]:
                - button "Drag Brainstorm Sketch" [ref=f4e129]
                - button "Brainstorm Sketch" [ref=f4e131]
            - listitem [ref=f4e141]:
              - generic [ref=f4e143]:
                - button "Drag Terminal" [ref=f4e144]
                - button "Terminal" [ref=f4e146]
            - listitem [ref=f4e150]:
              - generic [ref=f4e152]:
                - button "Drag Useful Links" [ref=f4e153]
                - button "Useful Links" [ref=f4e155]
            - listitem [ref=f4e160]:
              - generic [ref=f4e162]:
                - button "Drag Mail Apps" [ref=f4e163]
                - generic [ref=f4e166]:
                  - button "Mail Apps" [ref=f4e167]
                  - button "Toggle Mail Apps submenu" [ref=f4e172]
            - listitem [ref=f4e175]:
              - generic [ref=f4e177]:
                - button "Drag Vault" [ref=f4e178]
                - button "Vault" [ref=f4e180]
            - listitem [ref=f4e193]:
              - generic [ref=f4e195]:
                - button "Drag Settings" [ref=f4e196]
                - button "Settings" [ref=f4e198]
          - status [ref=f4e203]
      - generic [ref=f4e204]:
        - generic [ref=f4e205]: Workspace remembers your layout
        - list [ref=f4e206]:
          - listitem [ref=f4e207]:
            - button "TA tanimsyt tanimsyt@gmail.com" [ref=f4e208]:
              - generic [ref=f4e209]: TA
              - generic [ref=f4e211]:
                - generic [ref=f4e212]: tanimsyt
                - generic [ref=f4e213]: tanimsyt@gmail.com
    - main [ref=f4e217]:
      - generic [ref=f4e219]:
        - generic [ref=f4e220]:
          - generic [ref=f4e222]:
            - heading "Brainstorm Sketch" [level=1] [ref=f4e223]
            - paragraph [ref=f4e224]: A calm space to think visually.
          - button "New Board" [ref=f4e225]
        - generic [ref=f4e226]:
          - complementary [ref=f4e227]:
            - generic [ref=f4e228]:
              - generic [ref=f4e229]:
                - generic [ref=f4e230]: My Boards
                - button "Sort boards" [ref=f4e231]
              - textbox "Search boards…" [active] [ref=f4e237]: Alpha Board
              - generic [ref=f4e238]: No boards match your search.
              - button "New Board" [ref=f4e241]
          - main [ref=f4e242]:
            - generic [ref=f4e243]:
              - generic [ref=f4e244]:
                - button "Back to boards" [ref=f4e245]
                - button "New Brainstorm" [ref=f4e246]
                - generic [ref=f4e251]: Saved
                - button "Export" [ref=f4e252]
                - button "Board options" [ref=f4e253]
              - application "tldraw" [ref=f4e256]:
                - document:
                  - button "Move focus to canvas" [ref=f4e261] [cursor=pointer]
                  - generic:
                    - generic:
                      - navigation:
                        - generic:
                          - button "Menu" [ref=f4e262] [cursor=pointer]
                          - button "Page 1" [ref=f4e264] [cursor=pointer]
                    - generic [ref=f4e267]:
                      - generic [ref=f4e268]:
                        - toolbar "Color" [ref=f4e269]:
                          - radiogroup [ref=f4e270]:
                            - radio "Color — Black (selected)" [checked] [ref=f4e271] [cursor=pointer]
                            - radio "Color — Grey" [ref=f4e273] [cursor=pointer]
                            - radio "Color — Light violet" [ref=f4e275] [cursor=pointer]
                            - radio "Color — Violet" [ref=f4e277] [cursor=pointer]
                            - radio "Color — Blue" [ref=f4e279] [cursor=pointer]
                            - radio "Color — Light blue" [ref=f4e281] [cursor=pointer]
                            - radio "Color — Yellow" [ref=f4e283] [cursor=pointer]
                            - radio "Color — Orange" [ref=f4e285] [cursor=pointer]
                            - radio "Color — Green" [ref=f4e287] [cursor=pointer]
                            - radio "Color — Light green" [ref=f4e289] [cursor=pointer]
                            - radio "Color — Light red" [ref=f4e291] [cursor=pointer]
                            - radio "Color — Red" [ref=f4e293] [cursor=pointer]
                        - generic [ref=f4e296]:
                          - generic [ref=f4e297] [cursor=pointer]
                          - slider "Opacity — 100%" [ref=f4e300]
                      - generic [ref=f4e301]:
                        - toolbar "Fill" [ref=f4e302]:
                          - radiogroup [ref=f4e303]:
                            - radio "Fill — None (selected)" [checked] [ref=f4e304] [cursor=pointer]
                            - radio "Fill — Semi" [ref=f4e306] [cursor=pointer]
                            - radio "Fill — Solid" [ref=f4e308] [cursor=pointer]
                          - button "Fill" [ref=f4e311] [cursor=pointer]
                        - toolbar "Dash" [ref=f4e313]:
                          - radiogroup [ref=f4e314]:
                            - radio "Dash — Draw (selected)" [checked] [ref=f4e315] [cursor=pointer]
                            - radio "Dash — Dashed" [ref=f4e317] [cursor=pointer]
                            - radio "Dash — Dotted" [ref=f4e319] [cursor=pointer]
                            - radio "Dash — Solid" [ref=f4e321] [cursor=pointer]
                        - toolbar "Size" [ref=f4e323]:
                          - radiogroup [ref=f4e324]:
                            - radio "Size — Small" [ref=f4e325] [cursor=pointer]
                            - radio "Size — Medium (selected)" [checked] [ref=f4e327] [cursor=pointer]
                            - radio "Size — Large" [ref=f4e329] [cursor=pointer]
                            - radio "Size — Extra large" [ref=f4e331] [cursor=pointer]
                  - generic:
                    - generic:
                      - toolbar "Navigation" [ref=f4e334]:
                        - button "Zoom — 100%" [ref=f4e335] [cursor=pointer]:
                          - generic [ref=f4e336]: 100%
                      - generic:
                        - generic:
                          - generic:
                            - toolbar "Actions" [ref=f4e337]:
                              - button "Undo — Ctrl + Z" [disabled] [ref=f4e338]
                              - button "Redo — Ctrl + ⇧ + Z" [disabled] [ref=f4e340]
                              - button "Delete — ⌫" [disabled] [ref=f4e342]
                              - button "Duplicate — Ctrl + D" [disabled] [ref=f4e344]
                              - button "Actions" [ref=f4e347] [cursor=pointer]
                            - toolbar "Tools" [ref=f4e349]:
                              - generic [ref=f4e350]:
                                - button "Select — V" [pressed] [ref=f4e351] [cursor=pointer]
                                - button "Hand — H" [ref=f4e353] [cursor=pointer]
                                - button "Draw — D" [ref=f4e355] [cursor=pointer]
                                - button "Eraser — E" [ref=f4e357] [cursor=pointer]
                                - button "Arrow — A" [ref=f4e359] [cursor=pointer]
                                - button "Text — T" [ref=f4e361] [cursor=pointer]
                                - button "Note — N" [ref=f4e363] [cursor=pointer]
                                - button "Media — Ctrl + U" [ref=f4e365] [cursor=pointer]
                                - button "Rectangle — R" [ref=f4e367] [cursor=pointer]
                              - button "More" [ref=f4e370] [cursor=pointer]
                  - region "Notifications (F8)":
                    - list
                - button "Get a license for production" [ref=f4e373] [cursor=pointer]
    - region "Notifications alt+T"
  - generic [ref=f4e378] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=f4e379]
    - generic [ref=f4e383]:
      - button "Open issues overlay" [ref=f4e384]:
        - generic [ref=f4e385]:
          - generic [ref=f4e386]: "0"
          - generic [ref=f4e387]: "1"
        - generic [ref=f4e388]: Issue
      - button "Collapse issues badge" [ref=f4e389]
  - alert [ref=f4e392]: Brainstorm Sketch
```

# Test source

```ts
  1  | import { test } from "@playwright/test";
  2  | 
  3  | test("debug: rename with fixed code", async ({ page }) => {
  4  |   await page.goto("/login", { waitUntil: "domcontentloaded" });
  5  |   await page.fill("#email", "tanimsyt@gmail.com");
  6  |   await page.fill("#password", "Trimtales@2026");
  7  |   await page.click('button[type="submit"]');
  8  |   await page.waitForURL((u) => u.pathname !== "/login", { timeout: 30000 });
  9  |   await page.goto("/brainstorm-sketch", { waitUntil: "domcontentloaded" });
  10 |   await page.getByRole("heading", { name: "Brainstorm Sketch" }).waitFor();
  11 |   await page.getByRole("button", { name: "New Board" }).first().click();
  12 |   await page.waitForURL(/\/brainstorm-sketch\/.+/, { timeout: 15000 });
  13 |   await page.locator(".tl-canvas").waitFor({ timeout: 20000 });
  14 | 
  15 |   await page.getByRole("button", { name: "Board options" }).click();
  16 |   await page.getByText("Rename", { exact: true }).click({ force: true });
  17 |   await page.waitForTimeout(500);
  18 |   const tb = page.locator("main").getByRole("textbox").first();
  19 |   await tb.fill("Alpha Board");
  20 |   console.log("dom value:", await tb.inputValue());
  21 |   await tb.press("Enter");
  22 |   await page.waitForTimeout(1200);
  23 |   console.log("MAIN BUTTON TEXTS:", JSON.stringify(await page.locator("main button").allInnerTexts()));
  24 |   console.log("Alpha Board btn count:", await page.getByRole("button", { name: "Alpha Board" }).count());
> 25 |   console.log("topbar label:", (await page.locator("main").innerText()).slice(0, 200));
     |                                                            ^ Error: locator.innerText: Error: strict mode violation: locator('main') resolved to 2 elements:
  26 | });
  27 | 
```