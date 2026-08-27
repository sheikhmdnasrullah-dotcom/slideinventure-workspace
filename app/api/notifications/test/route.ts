import { getSessionUser } from "@/lib/appwrite/auth";
import { notifyViaNovu } from "@/lib/notifications/novu";
import { NextResponse } from "next/server";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const res = await notifyViaNovu({
    subscriberId: user.email ?? "system",
    email: user.email ?? undefined,
    title: "Test notification",
    body: "This is a test message from the Integrations Hub.",
  });
  return NextResponse.json(res);
}
