import { getSessionUser } from "@/lib/appwrite/auth";
import { startAgentWorkflow } from "@/lib/temporal/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const task = (body.task as string | undefined)?.toString().slice(0, 2000);
  if (!task?.trim()) return NextResponse.json({ error: "task required" }, { status: 400 });

  const res = await startAgentWorkflow({
    task: task.trim(),
    startUrl: typeof body.startUrl === "string" ? body.startUrl : undefined,
    userEmail: user.email,
  });
  return NextResponse.json(res);
}
