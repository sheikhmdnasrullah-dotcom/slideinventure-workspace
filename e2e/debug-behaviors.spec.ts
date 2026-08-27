import { test, expect, authenticate } from "./fixtures";
import type { Page } from "@playwright/test";

const apiJson = async (page: Page, path: string, init?: RequestInit) =>
  page.evaluate(
    async ([p, opts]) => {
      const res = await fetch(p as string, {
        ...(opts as RequestInit),
        headers: { "content-type": "application/json", ...((opts as RequestInit)?.headers ?? {}) },
      });
      return { status: res.status, text: await res.text() };
    },
    [path, init ?? {}]
  );

test("debug behaviors", async ({ page }) => {
  await authenticate(page.context(), "http://localhost:3000");
  const log: string[] = [];

  // AI Venture tab -> URL
  await page.goto("/concepts", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: /^Activity$/i }).first().click();
  await page.waitForTimeout(1500);
  log.push("AI-VENTURE URL after Activity click: " + page.url());

  // Brainstorm tab -> URL
  await page.goto("/brainstorm-sketch", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.getByRole("tab", { name: /Ideas/i }).first().click();
  await page.waitForTimeout(1500);
  log.push("BRAINSTORM URL after Ideas click: " + page.url());

  // Command palette Escape
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.keyboard.press("ControlOrMeta+k");
  await page.waitForTimeout(1000);
  const inputVisibleBefore = await page.getByPlaceholder(/search/i).first().isVisible().catch(() => false);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
  const inputVisibleAfter = await page.getByPlaceholder(/search/i).first().isVisible().catch(() => false);
  log.push(`PALETTE input visible before=${inputVisibleBefore} after=${inputVisibleAfter}`);

  // Notepad New note
  await page.goto("/notepad", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /New note/i }).first().click();
  await page.waitForTimeout(2000);
  const untitledVisible = await page.getByPlaceholder("Untitled").first().isVisible().catch(() => false);
  log.push("NOTEPAD Untitled input visible after New note: " + untitledVisible);

  // Ideas New map -> react-flow
  await page.goto("/ideas", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const newMap = page.getByRole("button", { name: /New map/i }).first();
  log.push("IDEAS New map button count: " + (await newMap.count()));
  await newMap.click();
  await page.waitForTimeout(4000);
  const rf = await page.locator(".react-flow").first().isVisible().catch(() => false);
  log.push("IDEAS react-flow visible after New map: " + rf);

  // Live event on note create
  const live = await page.evaluate(async () => {
    const source = new EventSource("/api/events/stream");
    const ready = await new Promise<boolean>((resolve) => {
      const t = setTimeout(() => resolve(false), 8000);
      source.addEventListener("ready", () => { clearTimeout(t); resolve(true); });
    });
    if (!ready) { source.close(); return { ready: false }; }
    const ev = new Promise<unknown>((resolve) => {
      const t = setTimeout(() => resolve(null), 8000);
      source.addEventListener("domain", (raw) => { clearTimeout(t); resolve(JSON.parse((raw as MessageEvent).data)); });
    });
    await fetch("/api/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "dbg-probe", content: "[]", scope: "global" }) });
    const e = await ev;
    source.close();
    return { ready: true, e };
  });
  log.push("LIVE ready=" + live.ready + " event=" + JSON.stringify(live.e));

  // cleanup probe
  const list = await apiJson(page, "/api/notes?scope=global");
  const notes = JSON.parse(list.text).notes ?? [];
  for (const n of notes.filter((x: any) => x.title === "dbg-probe")) {
    await apiJson(page, `/api/notes/${n.id}`, { method: "DELETE" });
  }

  console.log("DEBUGRESULTS:\n" + log.join("\n"));
  expect(true).toBe(true);
});
