import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getSessionUser } from "@/lib/appwrite/auth";
import { getEmailCrawlerBatch, processEmailCrawlerBatch, isBatchStale } from "@/lib/leads/email-crawler-batch";

export const maxDuration = 300;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const batch = await getEmailCrawlerBatch(id, user.email);
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  // Self-healing: if the worker that was running this batch appears to have
  // died (the platform killed the function before every row finished), the
  // next poll resumes it instead of leaving the batch stuck forever.
  if (isBatchStale(batch)) {
    waitUntil(processEmailCrawlerBatch(batch.id));
  }

  return NextResponse.json({
    id: batch.id,
    filename: batch.filename,
    status: batch.status,
    total: batch.total,
    completed: batch.completed,
    rows: batch.rows,
  });
}
