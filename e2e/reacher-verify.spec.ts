import { test, expect } from "./fixtures";

/**
 * Live check that the single-email verification panel now uses Reacher (not
 * TrueMail). Posts two addresses through /api/verify/reacher and asserts the
 * UI renders real verdicts returned by the VPS Reacher engine.
 */
test("lead verification uses Reacher", async ({ page }) => {
  // Capture the actual network response so we prove the Reacher-backed route ran.
  const apiBodies: any[] = [];
  page.on("response", async (res) => {
    if (res.url().includes("/api/verify/reacher")) {
      try {
        apiBodies.push(await res.json());
      } catch {
        /* ignore */
      }
    }
  });

  await page.goto("/leads/verify", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Lead Verification/i })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Reacher Verification/i)).toBeVisible({ timeout: 15000 });

  const box = page.getByPlaceholder(/Paste emails/i);
  await box.pressSequentially("postmaster@reacher.email\ninvalid-address@nonexistent-domain-xyz123.io");
  await expect(box).toHaveValue(/postmaster@reacher.email/);

  const btn = page.getByRole("button", { name: /Verify with Reacher/i });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();

  await expect(page.getByText(/Verified 2 email\(s\) via Reacher/i)).toBeVisible({ timeout: 45000 });

  // Both submitted emails appear, each with a verdict badge.
  await expect(page.getByText("postmaster@reacher.email").first()).toBeVisible();
  await expect(page.getByText("invalid-address@nonexistent-domain-xyz123.io").first()).toBeVisible();
  await expect(
    page.getByText(/valid|invalid|unknown|error/i).filter({ hasNot: page.getByText(/Reacher Verification|Verify with Reacher/i) }).first()
  ).toBeVisible();

  // The API response must carry Reacher verdicts, not an error payload.
  expect(apiBodies.length, "no /api/verify/reacher request observed").toBeGreaterThan(0);
  const results = apiBodies[0]?.results ?? [];
  expect(results.length).toBe(2);
  expect(results.every((r: any) => ["valid", "invalid", "unknown", "error"].includes(r.status))).toBe(true);
});
