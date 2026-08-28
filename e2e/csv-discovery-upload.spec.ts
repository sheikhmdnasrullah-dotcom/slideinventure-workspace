import { test, expect } from "./fixtures";

/**
 * Covers the Lead Discovery CSV upload path: local file -> parsed preview ->
 * request body actually sent to /api/csv-discovery.
 *
 * The POST is intercepted so the assertions can inspect the outgoing payload
 * without starting a real (billable, long-running) Temporal workflow.
 */

const CSV = [
  "channel,company,domain",
  // A quoted comma inside a field: the case a naive line.split(",") gets wrong.
  'https://youtube.com/@acme,"Acme, Inc",acme.com',
  "https://youtube.com/@globex,Globex,globex.io",
  "",
].join("\n");

async function attachCsv(page: import("@playwright/test").Page, body = CSV) {
  const input = page.locator("#csv-discovery-file");
  const doSet = () =>
    input.setInputFiles({
      name: "leads.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(body),
    });
  // setInputFiles assigns .files programmatically, which does not reliably raise
  // React's onChange on the first try in headless Chromium. A retry (after a
  // short settle) deterministically triggers the FileReader-based parse, the
  // same way a user re-selecting the file would.
  await doSet();
  await page.waitForTimeout(500);
  if ((await page.getByText(/leads\.csv/i).count()) === 0) await doSet();
}

test.describe("Lead Discovery CSV upload", () => {
  test("parses a local file and previews its contents", async ({ page }) => {
    await page.goto("/csv-discovery", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Lead Discovery/i })).toBeVisible({
      timeout: 30000,
    });
    await page.locator("#csv-discovery-file").waitFor({ state: "attached", timeout: 10000 });

    await attachCsv(page);

    // The file chip shows the parsed file name; scope to it so the sidebar
    // nav item ("Lead Discovery") can't be mistaken for a text match.
    const chip = page
      .locator("div")
      .filter({ has: page.getByText(/leads\.csv/i) })
      .first();
    await expect(chip.getByText(/leads\.csv/i)).toBeVisible({ timeout: 15000 });
    await expect(chip.getByText(/2 rows · 3 columns/i)).toBeVisible();

    // Detected columns are surfaced in the preview table header so the user can
    // confirm the header row was parsed (and the quoted "Acme, Inc" cell proves
    // a multi-comma field survived intact).
    const previewTable = page.getByRole("table").first();
    await expect(previewTable.getByText("channel", { exact: true })).toBeVisible();
    await expect(previewTable.getByText("domain", { exact: true })).toBeVisible();

    // The quoted comma must survive parsing as a single cell.
    await expect(page.getByText("Acme, Inc")).toBeVisible();

    await expect(
      page.getByRole("button", { name: /Start durable discovery \(2\)/i, exact: true })
    ).toBeEnabled();
  });

  test("sends correctly parsed rows to the API", async ({ page }) => {
    await page.goto("/csv-discovery", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Lead Discovery/i })).toBeVisible({
      timeout: 20000,
    });

    let posted: unknown = null;
    await page.route("**/api/csv-discovery", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      posted = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ workflowId: "test-workflow-id", error: null }),
      });
    });
    // Status polling also hits the same path via GET.
    await page.route("**/api/csv-discovery?*", async (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "COMPLETED", results: [] }),
      })
    );

    await attachCsv(page);
    await page.getByRole("button", { name: /Start durable discovery/ }).click();

    await expect(page.getByText("test-workflow-id")).toBeVisible({ timeout: 15000 });

    expect(posted).toEqual({
      rows: [
        { channel: "https://youtube.com/@acme", company: "Acme, Inc", domain: "acme.com" },
        { channel: "https://youtube.com/@globex", company: "Globex", domain: "globex.io" },
      ],
    });
  });

  test("rejects a non-CSV file and keeps the paste box available", async ({ page }) => {
    await page.goto("/csv-discovery", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Lead Discovery/i })).toBeVisible({
      timeout: 20000,
    });

    const input = page.locator("#csv-discovery-file");
    const rejectFile = () =>
      input.setInputFiles({
        name: "notes.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 not a csv"),
      });
    await rejectFile();
    await page.waitForTimeout(500);
    if ((await page.getByText(/Please choose a \.csv file/i).count()) === 0) await rejectFile();

    await expect(page.getByText(/Please choose a \.csv file/i)).toBeVisible({ timeout: 10000 });
    await expect(page.locator("textarea")).toBeVisible();
  });

  test("reports a CSV that has headers but no data rows", async ({ page }) => {
    await page.goto("/csv-discovery", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Lead Discovery/i })).toBeVisible({
      timeout: 20000,
    });

    await attachCsv(page, "channel,company\n");
    await expect(page.getByText(/no data rows/)).toBeVisible({ timeout: 10000 });
  });

  test("removing the file restores the paste box", async ({ page }) => {
    await page.goto("/csv-discovery", { waitUntil: "domcontentloaded" });
    await attachCsv(page);
    await expect(page.getByText(/leads\.csv/i)).toBeVisible({ timeout: 15000 });
    await expect(page.locator("textarea")).toHaveCount(0);

    await page.getByRole("button", { name: "Remove file" }).click();
    await expect(page.locator("textarea")).toBeVisible();
  });
});
