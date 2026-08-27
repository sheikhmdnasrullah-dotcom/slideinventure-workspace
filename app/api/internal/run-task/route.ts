import { NextRequest, NextResponse } from "next/server";
import { runBrowseTask } from "@/lib/browse/agent";
import { logActivity } from "@/lib/activities/client";

// Internal endpoint invoked by the Temporal worker's activity. Protected by a
// shared INTERNAL_API_TOKEN (set on both the app and the worker). The worker
// runs outside the request/auth context, so it authenticates with this token
// rather than a user session.
export async function POST(request: NextRequest) {
  const token = request.headers.get("x-internal-token");
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const task = (body.task as string | undefined)?.toString().slice(0, 2000);
  if (!task) return NextResponse.json({ error: "task required" }, { status: 400 });

  const res = await runBrowseTask({
    task,
    startUrl: typeof body.startUrl === "string" ? body.startUrl : undefined,
    userEmail: typeof body.userEmail === "string" ? body.userEmail : undefined,
  }).catch((e) => ({ ok: false, error: String(e) }));

  await logActivity({
    category: "agents",
    action: "executed",
    title: res.ok ? "Browse task completed" : "Browse task failed",
    description: (body.userEmail ? `[${body.userEmail}] ` : "") + task,
    entityType: "browse_task",
    metadata: { ok: res.ok },
  }).catch(() => {});

  return NextResponse.json(res);
}
