import { getSessionUser } from "@/lib/appwrite/auth";
import { crawlEmails } from "@/lib/leads/email-crawler";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const link = typeof body.link === "string" ? body.link : undefined;
  const details = typeof body.details === "string" ? body.details : "";
  const instructions = typeof body.instructions === "string" ? body.instructions : "";

  if (!link && !details) {
    return NextResponse.json({ error: "provide a link or prospect details" }, { status: 400 });
  }

  const result = await crawlEmails({
    link,
    details,
    instructions,
    userEmail: user.email,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "crawl failed" }, { status: 500 });
  }
  return NextResponse.json(result);
}
