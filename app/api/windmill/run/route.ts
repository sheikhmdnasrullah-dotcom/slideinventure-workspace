import { getSessionUser } from "@/lib/appwrite/auth";
import { runWindmillJob } from "@/lib/windmill/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const workspace = (body.workspace as string) || process.env.WINDMILL_WORKSPACE || "main";
  const path = (body.path as string)?.toString().slice(0, 200);
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });

  const res = await runWindmillJob({ workspace, path, args: body.args });
  return NextResponse.json(res);
}
