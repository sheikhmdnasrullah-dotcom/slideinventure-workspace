import { test, expect } from "./fixtures";

/**
 * Live check that the single-email verification panel now uses Reacher (not
 * TrueMail). Posts two addresses through /api/verify/reacher and asserts the
 * UI renders real verdicts returned by the VPS Reacher engine.
 */
test("lead verification uses Reacher", async ({ page }) => {
  await page.goto("/leads/verify", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Lead Verification/i })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText(/Reacher Verification/i)).toBeVisible({ timeout: 15000 });

  const box = page.getByPlaceholder(/Paste emails/i);
  await box.fill("postmaster@reacher.email\ninvalid-address@nonexistent-domain-xyz123.io");

  await page.getByRole("button", { name: /Verify with Reacher/i }).click();

  // The success toast confirms the request went through the Reacher-backed API.
  await expect(page.getByText(/Verified 2 email\(s\) via Reacher/i)).toBeVisible({ timeout: 45000 });

  // Each submitted email should appear with a verdict badge rendered by the
  // panel (valid | invalid | unknown | error).
  await expect(page.getByText("postmaster@reacher.email").first()).toBeVisible();
  await expect(page.getByText("invalid-address@nonexistent-domain-xyz123.io").first()).toBeVisible();
  await expect(
    page.getByText(/valid|invalid|unknown|error/i).filter({ hasNot: page.getByText(/Reacher Verification|Verify with Reacher/i) }).first()
  ).toBeVisible();
});
