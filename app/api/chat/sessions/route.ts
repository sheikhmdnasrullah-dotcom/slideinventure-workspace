import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.chatSessions;

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const res = await databases.listDocuments(DB, COL, [
    Query.equal("user_email", user.email!),
    Query.orderDesc("updated_at"),
    Query.limit(50),
  ]);

  const data = res.documents.map((d) => ({
    id: d.$id,
    title: d.title,
    updated_at: d.updated_at,
  }));

  return Response.json(data ?? []);
}
