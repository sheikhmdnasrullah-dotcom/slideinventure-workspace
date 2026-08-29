import { test, expect } from "./fixtures";

/**
 * Live check that the single-email verification panel now uses Reacher (not
 * TrueMail). Posts an address through /api/verify/reacher and asserts the UI
 * renders a real verdict returned by the VPS Reacher engine.
 */
test("lead verification uses Reacher", async ({ page }) => {
  const apiResults: any[] = [];
  page.on("response", async (res) => {
    if (res.url().includes("/api/verify/reacher")) {
      try {
        apiResults.push(...((await res.json()).results ?? []));
      } catch {
        /* ignore */
      }
    }
  });

  await page.goto("/leads/verify", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Lead Verification/i })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Reacher Verification/i)).toBeVisible({ timeout: 15000 });

  const box = page.getByPlaceholder(/Paste emails/i);
  // The Base UI textarea is occasionally missed by a single fill; retry until the
  // controlled value actually reflects what we typed.
  let populated = false;
  for (let i = 0; i < 5 && !populated; i++) {
    await box.fill("postmaster@reacher.email");
    try {
      await expect(box).toHaveValue(/postmaster@reacher.email/, { timeout: 2000 });
      populated = true;
    } catch {
      /* retry */
    }
  }
  await expect(box).toHaveValue(/postmaster@reacher.email/);

  const btn = page.getByRole("button", { name: /Verify with Reacher/i });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();

  // A real verdict badge must render for the checked address.
  await expect(page.getByText("postmaster@reacher.email").first()).toBeVisible({ timeout: 45000 });
  await expect(page.getByText(/Verified 1 email\(s\) via Reacher/i)).toBeVisible({ timeout: 45000 });

  // The backing API returned Reacher verdicts (not a TrueMail payload).
  expect(apiResults.length, "no /api/verify/reacher response observed").toBeGreaterThan(0);
  expect(apiResults[0].status).toMatch(/valid|invalid|unknown|error/);
});
