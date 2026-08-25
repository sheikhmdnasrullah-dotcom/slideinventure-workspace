import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { verifyInternalSecret } from "@/lib/auth/verify-internal-secret";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.taskRuns;

export async function POST(request: NextRequest) {
  if (!verifyInternalSecret(request)) {
    return ApiError.unauthorized("UNAUTHORIZED", "Invalid internal secret").toResponse();
  }

  const payload = await request.json().catch(() => ({}));

  const workflow = (payload as { workflow?: { id?: string; name?: string } }).workflow;
  const status = (payload as { status?: string }).status ?? "unknown";
  const runId = (payload as { runId?: string }).runId ?? randomUUID();

  try {
    await databases.createDocument(DB, COL, runId, {
      task_type: "automation",
      status: status === "success" ? "completed" : status === "error" ? "failed" : "running",
      command: workflow?.name ?? "n8n-webhook",
      output: JSON.stringify(payload),
      completed_at: new Date().toISOString(),
      metadata: JSON.stringify({
        workflow_id: workflow?.id ?? null,
        workflow_name: workflow?.name ?? null,
        source: "n8n",
      }),
    });
  } catch {
    return ApiError.badRequest("WEBHOOK_ERROR", "Invalid payload").toResponse();
  }

  return Response.json({ id: runId, status: "accepted" }, { status: 202 });
}
