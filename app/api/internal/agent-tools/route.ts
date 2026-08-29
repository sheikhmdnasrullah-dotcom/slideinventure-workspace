import { NextRequest, NextResponse } from "next/server";
import { searchVector } from "@/lib/retrieval/vector-index";
import { createWorkingMemory, getWorkingMemory } from "@/lib/memory/working-memory";
import { mem0Remember, mem0Recall, mem0Enabled } from "@/lib/memory/mem0";

// Internal-only surface for the self-hosted Mastra agent server: the pieces
// of the old in-process tool set (retrieve/remember/recall/browse) that need
// this app's Appwrite data stay here instead of being duplicated on the
// Mastra box. web_search and Composio tools don't need this — they're
// self-contained and run natively on the Mastra server.
function authorized(req: NextRequest): boolean {
  const secret = process.env.MASTRA_INTERNAL_SECRET;
  if (!secret) return false; // unlike CRON_SECRET, never open-by-default: this touches user data
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body?.action as string | undefined;

  try {
    switch (action) {
      case "retrieve": {
        const hits = await searchVector(String(body.query ?? ""), {
          collections: ["knowledge", "documents", "notes", "terminal", "links"],
          limit: 6,
        }).catch(() => []);
        return NextResponse.json({ hits });
      }
      case "remember": {
        const userEmail = String(body.userEmail ?? "");
        const content = String(body.content ?? "");
        if (!userEmail || !content) return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
        if (mem0Enabled()) await mem0Remember(userEmail, content).catch(() => {});
        const res = await createWorkingMemory({
          user_email: userEmail,
          content,
          source: body.source || "agent",
        }).catch(() => ({ success: false, error: "failed" }));
        return NextResponse.json({ ok: res.success, error: (res as any).error });
      }
      case "recall": {
        const userEmail = String(body.userEmail ?? "");
        if (!userEmail) return NextResponse.json({ text: "" });
        if (mem0Enabled()) {
          const mem0res = await mem0Recall(userEmail, "relevant facts").catch(() => "");
          if (mem0res) return NextResponse.json({ text: mem0res });
        }
        const entries = await getWorkingMemory(userEmail).catch(() => []);
        return NextResponse.json({ text: entries.map((e) => `- ${e.content}`).join("\n") || "(no memory)" });
      }
      case "browse": {
        const { runBrowseTask } = await import("@/lib/browse/agent");
        const task = String(body.task ?? "");
        if (!task) return NextResponse.json({ ok: false, error: "missing task" }, { status: 400 });
        const res = await runBrowseTask({
          task,
          startUrl: body.startUrl || undefined,
          userEmail: body.userEmail || undefined,
        }).catch(() => ({ ok: false, result: "", steps: [], error: "browse failed" }));
        return NextResponse.json(res);
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal tool call failed" },
      { status: 500 }
    );
  }
}
