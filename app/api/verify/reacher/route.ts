import { getSessionUser } from "@/lib/appwrite/auth";
import { verifyEmails } from "@/lib/verify/reacher";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const emails: string[] = Array.isArray(body.emails)
    ? body.emails.map((e: unknown) => String(e).trim()).filter(Boolean)
    : String(body.email || "")
        .split(/[\s,;]+/)
        .map((e: string) => e.trim())
        .filter(Boolean);

  if (!emails.length) return NextResponse.json({ error: "no emails provided" }, { status: 400 });

  const results = await verifyEmails(emails.slice(0, 200));
  return NextResponse.json({ results });
}
