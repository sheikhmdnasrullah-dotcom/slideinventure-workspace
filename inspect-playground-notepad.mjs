import { chromium } from "playwright";

const OUT = "/private/tmp/claude-501/-Users-nasrullahtanim-Downloads-workspace-app/e2b88ba3-7b09-4c48-94b1-51283be189e4/scratchpad";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

async function login() {
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    await page.fill("#email", "e2e-verify-test@slideinventure.com");
    await page.fill("#password", "E2eVaultTest_cq5r3d6m!9");
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL((url) => url.pathname !== "/login", { timeout: 8000 });
      return;
    } catch {
      await page.waitForTimeout(2000);
    }
  }
  throw new Error("login failed after retries");
}

await login();
console.log("logged in");
await page.goto("http://localhost:3000/concepts", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);

// ===== PLAYGROUND =====
// Seed a board directly via API (simulating one already created via Whiteboard)
const createRes = await page.request.post("http://localhost:3000/api/boards", {
  data: { title: "Playground Seed Board", scope: "ai-venture" },
});
const createJson = await createRes.json();
const seedId = createJson.board.id;
console.log("seeded board:", seedId);

await page.getByText("Playground", { exact: true }).first().click();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/av-playground-list.png` });

const cardVisible = await page.getByText("Playground Seed Board", { exact: true }).first().isVisible().catch(() => false);
console.log("Seed board visible in Playground:", cardVisible);

// Rename via UI: the pencil button is opacity-0 until group-hover, which
// Playwright's default actionability check treats as not-visible — force
// the click since we know the element is functionally present.
const card = page.locator("div.group", { hasText: "Playground Seed Board" }).first();
console.log("card count:", await card.count());
await card.hover();
const renameBtn = card.locator('button[title="Rename"]');
console.log("rename btn count:", await renameBtn.count());
await page.screenshot({ path: `${OUT}/av-playground-before-rename-click.png` });
await renameBtn.click({ force: true });
await page.waitForTimeout(300);
// The span with the old title is replaced by an <input> once rename mode
// toggles, so a locator scoped by hasText on the old title no longer
// matches (input values aren't text content) — locate the input directly.
const renameInput = page.locator("div.group input").first();
await renameInput.waitFor({ state: "visible", timeout: 5000 });
const putLog = [];
page.on("requestfinished", async (req) => {
  if (req.method() === "PUT" && req.url().includes("/api/boards/")) {
    const res = await req.response();
    const body = await res?.text().catch(() => null);
    putLog.push({ url: req.url(), reqBody: req.postData(), status: res?.status(), resBody: body });
  }
});
await renameInput.fill("Playground Renamed Board");
console.log("input value before Enter:", await renameInput.inputValue());
await renameInput.press("Enter");
await page.waitForTimeout(1500);
console.log("PUT requests captured:", JSON.stringify(putLog));

const afterRenameRes = await page.request.get(`http://localhost:3000/api/boards/${seedId}`);
const afterRenameJson = await afterRenameRes.json();
console.log("Title after UI rename (server):", afterRenameJson.board?.title);

// Delete via UI
await page.waitForTimeout(300);
const card2 = page.locator("div.group", { hasText: "Playground Renamed Board" }).first();
await card2.hover();
await card2.locator("svg.lucide-trash2").click({ force: true });
await page.waitForTimeout(600);

const afterDeleteRes = await page.request.get(`http://localhost:3000/api/boards/${seedId}`);
console.log("Status after delete (expect 404):", afterDeleteRes.status());
const stillVisible = await page.getByText("Playground Renamed Board", { exact: true }).first().isVisible().catch(() => false);
console.log("Still visible in UI after delete:", stillVisible);

// ===== NOTEPAD (ai-venture scope) =====
await page.locator(`.fixed.inset-0.z-50 button[aria-label="Close"]`).first().click();
await page.waitForTimeout(400);
await page.getByText("Notepad", { exact: true }).first().click();
await page.waitForTimeout(800);

await page.getByRole("button", { name: /Write Note/i }).click();
await page.waitForTimeout(800);

const titleInput = page.locator('input[placeholder="Untitled"]').first();
await titleInput.click();
await titleInput.fill("AV Notepad Test");
await page.waitForTimeout(200);

const editorArea = page.locator(".bn-editor, [contenteditable='true']").first();
await editorArea.click();
await page.keyboard.type("This note should survive close, reopen, and refresh.", { delay: 10 });
await page.waitForTimeout(1200); // 700ms debounce + margin

const listResBefore = await page.request.get("http://localhost:3000/api/notes?scope=ai-venture");
const listJsonBefore = await listResBefore.json();
const noteMatch = (listJsonBefore.notes ?? []).find((n) => n.title === "AV Notepad Test");
const noteId = noteMatch?.id;
console.log("note id:", noteId, "title:", noteMatch?.title);

const noteRes1 = await page.request.get(`http://localhost:3000/api/notes/${noteId}`);
const noteJson1 = await noteRes1.json();
const contentStr1 = JSON.stringify(noteJson1.note?.content ?? "");
console.log("Content contains typed text right after typing:", contentStr1.includes("should survive"));

// Close and reopen
await page.locator(`.fixed.inset-0.z-50 button[aria-label="Close"]`).first().click();
await page.waitForTimeout(400);
await page.getByText("Notepad", { exact: true }).first().click();
await page.waitForTimeout(800);
await page.getByText("AV Notepad Test", { exact: true }).first().click();
await page.waitForTimeout(600);

const noteRes2 = await page.request.get(`http://localhost:3000/api/notes/${noteId}`);
const noteJson2 = await noteRes2.json();
console.log("Content survives close/reopen:", JSON.stringify(noteJson2.note?.content ?? "").includes("should survive"));

// Hard refresh
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.getByText("Notepad", { exact: true }).first().click();
await page.waitForTimeout(800);
await page.getByText("AV Notepad Test", { exact: true }).first().click();
await page.waitForTimeout(600);

const noteRes3 = await page.request.get(`http://localhost:3000/api/notes/${noteId}`);
const noteJson3 = await noteRes3.json();
console.log("Content survives full page refresh:", JSON.stringify(noteJson3.note?.content ?? "").includes("should survive"));

// Verify it's NOT visible in global-scope notepad (scope isolation)
const globalListRes = await page.request.get("http://localhost:3000/api/notes?scope=global");
const globalListJson = await globalListRes.json();
const leaksIntoGlobal = (globalListJson.notes ?? []).some((n) => n.id === noteId);
console.log("AV note leaks into global scope (expect false):", leaksIntoGlobal);

// Delete via UI
const noteRow = page.locator("button", { hasText: "AV Notepad Test" }).first();
await noteRow.hover();
await noteRow.locator("svg.lucide-trash2").click({ force: true });
await page.waitForTimeout(600);

const noteRes4 = await page.request.get(`http://localhost:3000/api/notes/${noteId}`);
console.log("Note status after delete (expect 404):", noteRes4.status());

await page.locator(`.fixed.inset-0.z-50 button[aria-label="Close"]`).first().click();
await page.waitForTimeout(300);

console.log("errors:", JSON.stringify(errors.slice(0, 10)));
await browser.close();
console.log("PHASE_PLAYGROUND_NOTEPAD_DONE");
