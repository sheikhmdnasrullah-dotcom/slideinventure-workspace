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
  await page.setInputFiles("#csv-discovery-file", {
    name: "leads.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(body),
  });
}

test.describe("Lead Discovery CSV upload", () => {
  test("parses a local file and previews its contents", async ({ page }) => {
    await page.goto("/csv-discovery", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Lead Discovery/i })).toBeVisible({
      timeout: 20000,
    });

    await attachCsv(page);

    // The page uses uppercase text styles; match case-insensitively.
    await expect(page.getByText(/leads\.csv/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/2 rows · 3 columns/i)).toBeVisible();

    // Detected columns are surfaced so the user can confirm the header row.
    await expect(page.getByText(/channel/i, { exact: true })).toBeVisible();
    await expect(page.getByText(/domain/i, { exact: true })).toBeVisible();

    // The quoted comma must survive parsing as a single cell.
    await expect(page.getByText("Acme, Inc")).toBeVisible();

    await expect(page.getByRole("button", { name: /Start durable discovery \(2\)/i })).toBeEnabled();
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

    await page.setInputFiles("#csv-discovery-file", {
      name: "notes.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 not a csv"),
    });

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
    await expect(page.getByText("leads.csv")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("textarea")).toHaveCount(0);

    await page.getByRole("button", { name: "Remove file" }).click();
    await expect(page.locator("textarea")).toBeVisible();
  });
});
