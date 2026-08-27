import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
await page.fill("#email", "e2e-verify-test@slideinventure.com");
await page.fill("#password", "E2eVaultTest_cq5r3d6m!9");
await page.click('button[type="submit"]');
await page.waitForURL((url) => url.pathname !== "/login", { timeout: 15000 });

await page.goto("http://localhost:3000/todoist", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);

await page.screenshot({ path: "/private/tmp/claude-501/-Users-nasrullahtanim-Downloads-workspace-app/e2b88ba3-7b09-4c48-94b1-51283be189e4/scratchpad/todoist-list.png" });

// Try to open the "Add Task" dialog and the deadline picker
const addBtn = page.getByRole("button", { name: "Add Task" });
if (await addBtn.count() > 0) {
  await addBtn.first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/private/tmp/claude-501/-Users-nasrullahtanim-Downloads-workspace-app/e2b88ba3-7b09-4c48-94b1-51283be189e4/scratchpad/todoist-add-dialog.png" });

  const deadlineBtn = page.getByText("Set deadline (date & time)");
  if (await deadlineBtn.count() > 0) {
    await deadlineBtn.first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "/private/tmp/claude-501/-Users-nasrullahtanim-Downloads-workspace-app/e2b88ba3-7b09-4c48-94b1-51283be189e4/scratchpad/todoist-deadline-picker.png" });
  } else {
    console.log("deadline button not found");
  }
} else {
  console.log("Add Task button not found");
}

await browser.close();
console.log("done");
