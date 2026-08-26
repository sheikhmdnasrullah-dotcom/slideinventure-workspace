import { getSessionUser } from "@/lib/appwrite/auth";
import { harvestLeads } from "@/lib/leads/harvest";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const topic = (body.topic as string | undefined)?.toString().slice(0, 200);
  if (!topic?.trim()) return NextResponse.json({ error: "topic required" }, { status: 400 });

  const res = await harvestLeads({ topic: topic.trim(), userEmail: user.email });
  return NextResponse.json(res);
}
