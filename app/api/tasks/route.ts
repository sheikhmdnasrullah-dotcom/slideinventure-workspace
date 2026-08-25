import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.taskRuns;

function serialize(doc: Record<string, any>) {
  return {
    id: doc.$id,
    task_type: doc.task_type,
    status: doc.status,
    command: doc.command,
    exit_code: doc.exit_code,
    started_at: doc.started_at,
    completed_at: doc.completed_at,
    triggered_by: doc.triggered_by,
    knowledge_item_id: doc.knowledge_item_id,
  };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  let data: unknown[] = [];

  try {
    const result = await databases.listDocuments(DB, COL, [
      Query.orderDesc("started_at"),
      Query.limit(100),
    ]);
    data = result.documents.map(serialize);
  } catch {
    // Appwrite unreachable; return empty list
  }

  return Response.json(data);
}
