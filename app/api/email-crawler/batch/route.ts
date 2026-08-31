import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { waitUntil } from "@vercel/functions";
import { getSessionUser } from "@/lib/appwrite/auth";
import {
  createEmailCrawlerBatches,
  processEmailCrawlerBatchAndChain,
} from "@/lib/leads/email-crawler-batch";

// A batch can run well past a single request/response cycle (worst case
// observed: ~6 minutes for one row that exhausts all five agents). waitUntil
// keeps this running after the response is sent; the self-chaining processor
// re-schedules follow-up windows so large uploads finish even with no tab open.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    let file: File | null = null;
    let csvText: string | null = null;

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData().catch(() => null);
      const f = formData?.get("file");
      if (f instanceof File) file = f;
    } else {
      const body = await request.json().catch(() => null);
      if (typeof body?.csv === "string") csvText = body.csv;
    }

    if (file) {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        return NextResponse.json({ error: "Only .csv files are accepted" }, { status: 400 });
      }
      csvText = await file.text();
    }

    if (!csvText || !csvText.trim()) {
      return NextResponse.json({ error: "No CSV file or content provided" }, { status: 400 });
    }

    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    const rows = (parsed.data || []).filter((r) => Object.values(r).some((v) => (v ?? "").toString().trim()));
    if (!rows.length) {
      return NextResponse.json({ error: "CSV has no usable rows" }, { status: 400 });
    }

    // No per-intake cap: chunk the upload into as many background batches as
    // needed, and chain each one so it keeps running to completion unattended.
    const batches = await createEmailCrawlerBatches(user.email, file?.name || "leads.csv", rows);
    const origin = new URL(request.url).origin;
    for (const batch of batches) {
      waitUntil(processEmailCrawlerBatchAndChain(batch.id, origin));
    }

    return NextResponse.json({
      batchIds: batches.map((b) => b.id),
      total: rows.length,
      batchCount: batches.length,
    });
  } catch (e: any) {
    console.error("[email-crawler/batch] upload failed:", e);
    return NextResponse.json(
      { error: e?.message ? `Upload failed: ${e.message}` : "Upload failed" },
      { status: 500 },
    );
  }
}
