import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery, validate } from "@/lib/api/validation";
import { z } from "zod";
import { UsefulLinkSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.usefulLinks;

type LinkDocument = Record<string, unknown> & {
  $id: string;
  created_at?: string;
};

function serialize(doc: LinkDocument) {
  const out: Record<string, unknown> = { id: doc.$id };
  for (const [k, v] of Object.entries(doc)) {
    if (k.startsWith("$")) continue;
    out[k] = v;
  }
  return out;
}

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
  tag: z.string().optional(),
});

const CreateSchema = UsefulLinkSchema.omit({ id: true, createdAt: true, updatedAt: true });

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);
  const email = user.email ?? "";
  const page = query.data.page;
  const pageSize = query.data.pageSize;

  try {
    let docs: LinkDocument[] = [];
    let total = 0;

    if (query.data.search) {
      const term = query.data.search;
      const base = [Query.equal("created_by", email)];
      if (query.data.tag) base.push(Query.contains("tags", [query.data.tag]));
      const searches = await Promise.all([
        databases.listDocuments(DB, COL, [...base, Query.search("title", term), Query.limit(1000)]),
        databases.listDocuments(DB, COL, [...base, Query.search("url", term), Query.limit(1000)]),
      ]);
      const map = new Map<string, LinkDocument>();
      for (const res of searches) for (const d of res.documents) if (!map.has(d.$id)) map.set(d.$id, d);
      docs = [...map.values()].sort(
        (a, b) => (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0)
      );
      total = docs.length;
      const from = (page - 1) * pageSize;
      docs = docs.slice(from, from + pageSize);
    } else {
      const queries = [Query.equal("created_by", email), Query.orderDesc("created_at")];
      if (query.data.tag) queries.push(Query.contains("tags", [query.data.tag]));
      queries.push(Query.limit(pageSize), Query.offset((page - 1) * pageSize));
      const res = await databases.listDocuments(DB, COL, queries);
      docs = res.documents;
      total = res.total;
    }

    return Response.json({ data: docs.map(serialize), total, page, pageSize });
  } catch (error) {
    return ApiError.internal("DB_ERROR", (error as Error).message).toResponse();
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  try {
    const validated = validate(CreateSchema, body);
    const d = validated.data;
    const now = new Date().toISOString();
    const fallbackTitle = (() => {
      try {
        const u = new URL(d.url);
        return (u.hostname + u.pathname).replace(/\/$/, "");
      } catch {
        return d.url;
      }
    })();

    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      title: d.title?.trim() || fallbackTitle,
      url: d.url,
      description: d.description ?? null,
      tags: d.tags ?? [],
      favicon: d.favicon ?? null,
      created_by: user.email ?? null,
      created_at: now,
      updated_at: now,
    });

    return Response.json({ id: doc.$id }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return err.toResponse();
    return ApiError.internal("UNHANDLED", err instanceof Error ? err.message : "Unknown error").toResponse();
  }
}
