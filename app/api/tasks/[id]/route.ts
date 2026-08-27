import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { logActivity } from "@/lib/activities/client";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const RUNS = APPWRITE.collections.taskRuns;
const EVENTS = APPWRITE.collections.taskRunEvents;

const BATCH = 100;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;

  const run = await databases.getDocument(DB, RUNS, id).catch(() => null);
  if (!run) {
    return ApiError.notFound("TASK_RUN_NOT_FOUND", "Task run not found").toResponse();
  }

  try {
    // Remove every event row for this run, paging through batches.
    let removed = 0;
    while (true) {
      const res = await databases.listDocuments(DB, EVENTS, [
        Query.equal("task_run_id", id),
        Query.limit(BATCH),
      ]);
      if (res.documents.length === 0) break;
      for (const doc of res.documents) {
        await databases.deleteDocument(DB, EVENTS, doc.$id);
        removed += 1;
      }
      if (res.documents.length < BATCH) break;
    }

    await databases.deleteDocument(DB, RUNS, id);

    await logActivity({
      category: "agents",
      action: "deleted",
      title: (run.task_type as string) ?? "Task run",
      description: `Deleted task run with ${removed} event(s)`,
      entityId: id,
      entityType: "task_run",
      metadata: { eventCount: removed },
    }).catch(() => {});

    return Response.json({ id, status: "deleted", eventsRemoved: removed });
  } catch (error) {
    return toJson(error);
  }
}
