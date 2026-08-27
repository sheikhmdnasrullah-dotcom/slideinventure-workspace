import { test, expect, authenticate } from "./fixtures";

test("debug palette escape", async ({ page }) => {
  await authenticate(page.context(), "http://localhost:3000");
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.keyboard.press("ControlOrMeta+k");
  await page.waitForTimeout(1000);
  const before = await page.getByPlaceholder(/search/i).first().isVisible().catch(() => false);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
  const after = await page.getByPlaceholder(/search/i).first().isVisible().catch(() => false);
  console.log("PALETTE before=" + before + " after=" + after);
  expect(true).toBe(true);
});

test("debug overflow source", async ({ page }) => {
  await authenticate(page.context(), "http://localhost:3000");
  await page.setViewportSize({ width: 820, height: 900 });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const wide = await page.evaluate(() => {
    const vw = window.innerWidth;
    const docEl = document.documentElement;
    const out: string[] = [];
    out.push(`vw=${vw} scrollW=${docEl.scrollWidth} clientW=${docEl.clientWidth} bodyScrollW=${document.body.scrollWidth}`);
    let maxRight = 0;
    let maxEl = "";
    document.querySelectorAll("*").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > maxRight) { maxRight = r.right; maxEl = `${el.tagName}.${(el as HTMLElement).className?.toString().slice(0,50)}`; }
      if (r.right > vw + 1) {
        out.push(`OVER ${el.tagName}.${(el as HTMLElement).className?.toString().slice(0,50)} right=${Math.round(r.right)} w=${Math.round(r.width)} left=${Math.round(r.left)}`);
      }
    });
    out.push(`MAXRIGHT=${Math.round(maxRight)} ${maxEl}`);
    return out;
  });
  console.log("OVERFLOW_ELEMENTS:\n" + wide.join("\n"));
  expect(true).toBe(true);
});
