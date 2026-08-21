import { verifyInternalSecret } from "@/lib/auth/verify-internal-secret";
import { syncKnowledge } from "@/lib/knowledge/sync";

export async function POST(request: Request) {
  if (!verifyInternalSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncKnowledge(process.cwd());
    return Response.json({
      status: result.success ? "completed" : "failed",
      output: result.output,
      counters: result.counters,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
