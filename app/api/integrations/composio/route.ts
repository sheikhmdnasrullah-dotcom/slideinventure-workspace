import { getSessionUser } from "@/lib/appwrite/auth";
import { listComposioConnections } from "@/lib/integrations/composio";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const connections = await listComposioConnections();
  return NextResponse.json({ enabled: connections !== null, connections });
}
