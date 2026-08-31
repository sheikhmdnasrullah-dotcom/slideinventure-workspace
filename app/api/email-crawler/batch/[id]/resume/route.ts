import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getSessionUser } from "@/lib/appwrite/auth";
import { getEmailCrawlerBatch, processEmailCrawlerBatchAndChain } from "@/lib/leads/email-crawler-batch";

// Re-entry point for the self-chaining background worker. Each processing cycle
// pings this endpoint when rows are still pending, opening a fresh `waitUntil`
// window so a large batch keeps crawling past a single function's maxDuration —
// and with no browser tab required.
export const maxDuration = 300;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const batch = await getEmailCrawlerBatch(id, user.email);
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const origin = new URL(_request.url).origin;
  waitUntil(processEmailCrawlerBatchAndChain(id, origin));

  return NextResponse.json({ ok: true, id });
}
