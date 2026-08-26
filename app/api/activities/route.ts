import { getSessionUser } from "@/lib/appwrite/auth";
import { databases, Query } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.activities;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 120, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const url = new URL(request.url);
  const category = url.searchParams.get("category") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const pageSize = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 40), 1), 120);

  const queries: any[] = [Query.orderDesc("timestamp"), Query.limit(pageSize)];
  if (category) queries.push(Query.equal("category", category));

  try {
    const res = await databases.listDocuments(DB, COL, queries);
    const activities = res.documents.map((d: any) => ({
      id: d.$id,
      category: d.category,
      action: d.action,
      title: d.title,
      description: d.description,
      entityId: d.entity_id ?? undefined,
      entityType: d.entity_type ?? undefined,
      timestamp: d.timestamp,
      metadata: d.metadata ? (typeof d.metadata === "string" ? JSON.parse(d.metadata) : d.metadata) : undefined,
      userEmail: d.user_email ?? undefined,
    }));
    return Response.json({
      activities,
      nextCursor: res.documents.length === pageSize ? res.documents[res.documents.length - 1].$id : null,
    });
  } catch {
    return Response.json({ activities: [] });
  }
}
