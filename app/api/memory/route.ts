import { getSessionUser } from "@/lib/appwrite/auth";
import {
  createWorkingMemory,
  getWorkingMemory,
  deleteWorkingMemory,
  promoteToKnowledge,
  getWorkingMemoryStats,
} from "@/lib/memory/working-memory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const includeExpired = request.nextUrl.searchParams.get("includeExpired") === "1";
  const stats = request.nextUrl.searchParams.get("stats") === "1";
  const entries = await getWorkingMemory(user.email, { includeExpired });
  if (stats) {
    return NextResponse.json({ entries, stats: await getWorkingMemoryStats(user.email) });
  }
  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const content = (body.content as string | undefined)?.toString().slice(0, 5000);
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });

  const res = await createWorkingMemory({
    user_email: user.email,
    content,
    source: (body.source as string) || "manual",
    context: body.context || {},
    ttl_hours: body.ttl_hours,
  });
  if (!res.success) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ entry: res.entry });
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const res = await deleteWorkingMemory(id);
  if (!res.success) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Re-export for a potential promote endpoint (kept inline for simplicity).
export { promoteToKnowledge };
