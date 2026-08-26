import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery, validate } from "@/lib/api/validation";
import { z } from "zod";
import { TerminalCommandSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";
import { logActivity } from "@/lib/activities/client";
import { upsertVector } from "@/lib/retrieval/vector-index";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.terminalCommands;

const JSON_KEYS = ["metadata", "variables"];

type TerminalDocument = Record<string, unknown> & {
  $id: string;
  created_at?: string;
};

function serialize(doc: TerminalDocument) {
  const out: Record<string, unknown> = { id: doc.$id };
  for (const [k, v] of Object.entries(doc)) {
    if (k.startsWith("$")) continue;
    out[k] = JSON_KEYS.includes(k) && typeof v === "string" ? JSON.parse(v) : v;
  }
  return out;
}

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  favorite: z.coerce.boolean().optional(),
});

const CreateSchema = TerminalCommandSchema.omit({ id: true, createdAt: true, updatedAt: true });

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return toJson(ApiError.unauthorized());

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return toJson(ApiError.rateLimited());

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);
  const email = user.email ?? "";
  const page = query.data.page;
  const pageSize = query.data.pageSize;

  try {
    let docs: TerminalDocument[] = [];
    let total = 0;

    if (query.data.search) {
      const term = query.data.search;
      const base = [Query.equal("triggered_by", email)];
      if (query.data.category) base.push(Query.equal("category", query.data.category));
      if (query.data.favorite !== undefined) base.push(Query.equal("favorite", query.data.favorite));
      const searches = await Promise.all([
        databases.listDocuments(DB, COL, [...base, Query.search("title", term), Query.limit(1000)]),
        databases.listDocuments(DB, COL, [...base, Query.search("command", term), Query.limit(1000)]),
        databases.listDocuments(DB, COL, [...base, Query.search("description", term), Query.limit(1000)]),
      ]);
      const map = new Map<string, TerminalDocument>();
      for (const res of searches) for (const d of res.documents) if (!map.has(d.$id)) map.set(d.$id, d);
      docs = [...map.values()].sort(
        (a, b) => (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0)
      );
      total = docs.length;
      const from = (page - 1) * pageSize;
      docs = docs.slice(from, from + pageSize);
    } else {
      const queries = [Query.equal("triggered_by", email), Query.orderDesc("created_at")];
      if (query.data.category) queries.push(Query.equal("category", query.data.category));
      if (query.data.favorite !== undefined) queries.push(Query.equal("favorite", query.data.favorite));
      queries.push(Query.limit(pageSize), Query.offset((page - 1) * pageSize));
      const res = await databases.listDocuments(DB, COL, queries);
      docs = res.documents;
      total = res.total;
    }

    return Response.json({ data: docs.map(serialize), total, page, pageSize });
  } catch (error) {
    return toJson(ApiError.internal("DB_ERROR", (error as Error).message));
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return toJson(ApiError.unauthorized());

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return toJson(ApiError.rateLimited());

  const body = await request.json().catch(() => ({}));
  try {
    const validated = validate(CreateSchema, body);
    const now = new Date().toISOString();
    const d = validated.data;

    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      command: d.command,
      cwd: d.cwd ?? null,
      exit_code: d.exitCode ?? null,
      stdout: d.stdout ?? null,
      stderr: d.stderr ?? null,
      duration_ms: d.durationMs ?? null,
      triggered_by: user.email ?? d.triggeredBy ?? null,
      metadata: JSON.stringify(d.metadata ?? {}),
      title: d.title,
      description: d.description ?? null,
      category: d.category ?? null,
      tags: d.tags ?? [],
      notes: d.notes ?? null,
      variables: JSON.stringify(d.variables ?? {}),
      favorite: d.favorite ?? false,
      created_at: now,
      updated_at: now,
    });

    logActivity({
      category: "terminal",
      action: "created",
      title: d.title || d.command,
      description: d.description ?? d.command,
      entityId: doc.$id,
      entityType: "terminal_command",
      metadata: { command: d.command, category: d.category ?? null, exit_code: d.exitCode ?? null },
    }).catch(() => {});

    const text = [d.title, d.command, d.description, d.notes].filter(Boolean).join("\n");
    upsertVector({ collection: "terminal", docId: doc.$id, text }).catch(() => {});

    return Response.json({ id: doc.$id }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return toJson(err);
    return toJson(ApiError.internal("UNHANDLED", err instanceof Error ? err.message : "Unknown error"));
  }
}
