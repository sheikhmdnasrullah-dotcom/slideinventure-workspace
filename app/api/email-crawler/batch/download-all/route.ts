import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { getSessionUser } from "@/lib/appwrite/auth";
import { getEmailCrawlerBatch } from "@/lib/leads/email-crawler-batch";

// Combines every batch of one upload into a single CSV, so a large list that was
// split into multiple background batches downloads as one file.
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ids = (request.nextUrl.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.length) return NextResponse.json({ error: "No batch ids provided" }, { status: 400 });

  const outRows: Record<string, string>[] = [];
  for (const id of ids) {
    const batch = await getEmailCrawlerBatch(id, user.email);
    if (!batch) continue;
    const originalHeaders = Array.from(new Set(batch.rows.flatMap((r) => Object.keys(r.input))));
    for (const r of batch.rows) {
      const base: Record<string, string> = {};
      for (const h of originalHeaders) base[h] = r.input[h] ?? "";
      outRows.push({
        ...base,
        detected_link_type: r.detectedType,
        detected_link: r.detectedLink ?? "",
        email: r.emails[0] ?? "",
        all_emails: r.emails.join("; "),
        verdict: r.verdicts[0] ?? "",
        found_by_agent: r.agent ?? "",
        status: r.status === "done" ? (r.emails.length ? "found" : "not_found") : r.status,
        error: r.error ?? "",
      });
    }
  }

  if (!outRows.length) return NextResponse.json({ error: "No rows to export" }, { status: 404 });

  const csv = Papa.unparse(outRows);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `email-crawler-bulk-${stamp}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
