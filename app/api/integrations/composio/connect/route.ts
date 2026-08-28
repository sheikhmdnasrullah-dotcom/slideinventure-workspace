import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { initiateComposioConnection } from "@/lib/integrations/composio";
import { CONNECTABLE_TOOLKITS, type ConnectableToolkitSlug } from "@/lib/integrations/composio-toolkits";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = checkRateLimit(req, { limit: 10, windowMs: 60_000, identifier: `composio-connect:${user.id}` });
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const toolkit = (body.toolkit ?? "").toString().toLowerCase() as ConnectableToolkitSlug;
  if (!CONNECTABLE_TOOLKITS.some((t) => t.slug === toolkit)) {
    return NextResponse.json({ error: "Unknown app" }, { status: 400 });
  }

  const result = await initiateComposioConnection(toolkit, `${req.nextUrl.origin}/integrations`);
  if ("error" in result) return NextResponse.json(result, { status: 502 });
  return NextResponse.json(result);
}
