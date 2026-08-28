import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { logActivity } from "@/lib/activities/client";
import { normalizeBoardScope, BOARD_SCOPE_ACTIVITY } from "@/lib/boards/scope";
import { ensureBoardsCollection } from "@/lib/boards/ensure";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.boards;

type BoardDoc = {
  $id: string
  title?: string | null
  content?: string | null
  scope?: string | null
  created_at?: string | null
  updated_at?: string | null
}

function serialize(doc: BoardDoc) {
  return {
    id: doc.$id,
    title: doc.title ?? null,
    content: doc.content ?? "{}",
    scope: doc.scope || "global",
    created_at: doc.created_at ?? "",
    updated_at: doc.updated_at ?? "",
  };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 60, windowMs: 60_000, identifier: `boards-list:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const scope = request.nextUrl.searchParams.get("scope");

  try {
    await ensureBoardsCollection();
    const queries = [Query.equal("user_email", user.email ?? ""), Query.orderDesc("updated_at")];
    if (scope) queries.push(Query.equal("scope", scope));
    const res = await databases.listDocuments(DB, COL, queries);
    return Response.json({ boards: res.documents.map(serialize) });
  } catch (error) {
    return toJson(error);
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000, identifier: `boards-create:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const title = (body.title as string | undefined)?.toString().slice(0, 200) || "New board";
    const scope = normalizeBoardScope(body.scope);
    const now = new Date().toISOString();
    await ensureBoardsCollection();
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      user_email: user.email ?? "",
      title,
      content: "{}",
      scope,
      created_at: now,
      updated_at: now,
    });

    const { category, label } = BOARD_SCOPE_ACTIVITY[scope];
    logActivity({
      category,
      action: "created",
      title: `${label} created`,
      description: title,
      entityId: doc.$id,
      entityType: "board",
      metadata: { scope },
    }).catch(() => {});

    return Response.json({ board: serialize(doc) }, { status: 201 });
  } catch (error) {
    return toJson(error);
  }
}
