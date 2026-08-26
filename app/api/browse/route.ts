import { getSessionUser } from "@/lib/appwrite/auth";
import { runBrowseTask } from "@/lib/browse/agent";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const task = (body.task as string | undefined)?.toString().slice(0, 2000);
  const startUrl = (body.startUrl as string | undefined)?.toString().slice(0, 2000);
  if (!task) return NextResponse.json({ error: "task required" }, { status: 400 });

  const result = await runBrowseTask({ task, startUrl, userEmail: user.email });
  return NextResponse.json(result);
}
