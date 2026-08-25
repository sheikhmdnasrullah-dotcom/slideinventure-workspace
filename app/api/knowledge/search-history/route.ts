import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.knowledgeSearchHistory;

export async function GET(_request: NextRequest) {
  const user = await getSessionUser();
  if (!user?.email) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(_request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const res = await databases.listDocuments(DB, COL, [
    Query.equal("user_email", user.email),
    Query.orderDesc("created_at"),
    Query.limit(20),
  ]);

  const data = res.documents.map((d) => ({
    id: d.$id,
    query: d.query,
    mode: d.mode,
    result_count: d.result_count,
    created_at: d.created_at,
  }));

  return Response.json(data ?? []);
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user?.email) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  const res = await databases.listDocuments(DB, COL, [
    Query.equal("user_email", user.email),
    ...(id ? [Query.equal("$id", id)] : []),
    Query.limit(1000),
  ]);

  await Promise.all(
    res.documents.map((d) => databases.deleteDocument(DB, COL, d.$id))
  );

  return Response.json({ status: "deleted" });
}
