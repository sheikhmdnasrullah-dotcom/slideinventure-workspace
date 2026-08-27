import { getSessionUser } from "@/lib/appwrite/auth";
import { mem0Enabled, mem0Remember, mem0Recall } from "@/lib/memory/mem0";
import { NextResponse } from "next/server";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!mem0Enabled()) return NextResponse.json({ enabled: false, message: "Mem0 not configured" });

  const content = `Test memory entry from Integrations Hub at ${new Date().toISOString()}`;
  await mem0Remember(user.email, content).catch(() => {});
  const recalled = await mem0Recall(user.email, "test memory").catch(() => "");
  return NextResponse.json({ enabled: true, remembered: content, recalled });
}
