import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { getSessionUser } from "@/lib/appwrite/auth";
import { getEmailCrawlerBatch } from "@/lib/leads/email-crawler-batch";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const batch = await getEmailCrawlerBatch(id, user.email);
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const originalHeaders = Array.from(new Set(batch.rows.flatMap((r) => Object.keys(r.input))));
  const outRows = batch.rows.map((r) => {
    const base: Record<string, string> = {};
    for (const h of originalHeaders) base[h] = r.input[h] ?? "";
    return {
      ...base,
      detected_link_type: r.detectedType,
      detected_link: r.detectedLink ?? "",
      email: r.emails[0] ?? "",
      all_emails: r.emails.join("; "),
      verdict: r.verdicts[0] ?? "",
      found_by_agent: r.agent ?? "",
      status: r.status === "done" ? (r.emails.length ? "found" : "not_found") : r.status,
      error: r.error ?? "",
    };
  });

  const csv = Papa.unparse(outRows);
  const filename = batch.filename.replace(/\.csv$/i, "") + "-with-emails.csv";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
    },
  });
}
