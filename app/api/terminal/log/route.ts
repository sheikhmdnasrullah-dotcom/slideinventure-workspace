import { getSessionUser } from "@/lib/appwrite/auth";
import { logActivity } from "@/lib/activities/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const command = (body.command as string | undefined)?.toString().slice(0, 2000);
  if (!command) return NextResponse.json({ ok: true });

  await logActivity({
    userEmail: user.email,
    category: "terminal",
    action: "command",
    description: command,
    metadata: { source: "live-shell" },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
