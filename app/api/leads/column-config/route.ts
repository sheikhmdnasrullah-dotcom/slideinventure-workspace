import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { LeadColumnConfigSchema, DEFAULT_COLUMNS } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.leadColumnConfigs;

const ColumnSchema = z.object({
  columns: z.array(LeadColumnConfigSchema),
});

function parseColumns(value: unknown): unknown[] {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  try {
    const res = await databases.listDocuments(DB, COL, [Query.equal("user_id", user.id)]);
    if (res.documents.length === 0) {
      return Response.json({ columns: DEFAULT_COLUMNS });
    }
    return Response.json({ columns: parseColumns(res.documents[0].columns) });
  } catch (error) {
    return toJson(error);
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(ColumnSchema, body);
  const now = new Date().toISOString();

  try {
    const res = await databases.listDocuments(DB, COL, [Query.equal("user_id", user.id)]);
    const columnsJson = JSON.stringify(validated.data.columns);

    if (res.documents.length > 0) {
      const existing = res.documents[0];
      await databases.updateDocument(DB, COL, existing.$id, {
        columns: columnsJson,
        updated_at: now,
      });
    } else {
      await databases.createDocument(DB, COL, ID.unique(), {
        user_id: user.id,
        columns: columnsJson,
        created_at: now,
        updated_at: now,
      });
    }

    return Response.json({ columns: validated.data.columns });
  } catch (error) {
    return toJson(error);
  }
}
