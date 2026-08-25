import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery } from "@/lib/api/validation";
import { z } from "zod";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.chatMessages;

const ListSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
});

function parseJson(value: unknown, fallback: unknown) {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);

  const res = await databases.listDocuments(DB, COL, [
    Query.equal("session_id", query.data.sessionId),
    Query.orderAsc("created_at"),
    Query.limit(200),
  ]);

  const data = res.documents.map((d) => ({
    id: d.$id,
    role: d.role,
    content: d.content,
    evidence: parseJson(d.evidence, []),
    filters: parseJson(d.filters, {}),
    created_at: d.created_at,
  }));

  return Response.json(data ?? []);
}
