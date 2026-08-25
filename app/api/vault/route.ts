import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery, validate } from "@/lib/api/validation";
import { z } from "zod";
import { SecretVaultEntrySchema } from "@/lib/api/schemas";
import { encryptSecret } from "@/lib/vault/crypto";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.vault;

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  category: z.string().optional(),
  search: z.string().optional(),
});

const CreateSchema = SecretVaultEntrySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  iv: true,
  keyVersion: true,
});

function serialize(doc: Record<string, any>) {
  return {
    id: doc.$id,
    name: doc.name,
    category: doc.category,
    service_name: doc.service_name,
    username: doc.username,
    secret_type: doc.secret_type,
    url: doc.url,
    notes: doc.notes,
    tags: doc.tags ?? [],
    expires_at: doc.expires_at,
    created_by: doc.created_by,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);
  const email = user.email ?? "";
  const page = query.data.page;
  const pageSize = query.data.pageSize;

  let docs: Record<string, any>[] = [];
  let total = 0;

  if (query.data.search) {
    const term = query.data.search;
    const searches = await Promise.all([
      databases.listDocuments(DB, COL, [Query.equal("created_by", email), Query.search("name", term), Query.limit(1000)]),
      databases.listDocuments(DB, COL, [Query.equal("created_by", email), Query.search("service_name", term), Query.limit(1000)]),
      databases.listDocuments(DB, COL, [Query.equal("created_by", email), Query.search("username", term), Query.limit(1000)]),
    ]);
    const map = new Map<string, Record<string, any>>();
    for (const res of searches) for (const d of res.documents) if (!map.has(d.$id)) map.set(d.$id, d);
    docs = [...map.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    total = docs.length;
    const from = (page - 1) * pageSize;
    docs = docs.slice(from, from + pageSize);
  } else {
    const queries = [Query.equal("created_by", email), Query.orderDesc("created_at")];
    if (query.data.category) queries.push(Query.equal("category", query.data.category));
    queries.push(Query.limit(pageSize), Query.offset((page - 1) * pageSize));
    const res = await databases.listDocuments(DB, COL, queries);
    docs = res.documents;
    total = res.total;
  }

  return Response.json({ data: docs.map(serialize), total, page, pageSize });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const validated = validate(CreateSchema, body);

  const secretPlaintext = validated.data.encryptedValue;
  if (!secretPlaintext || secretPlaintext.trim() === "") {
    return ApiError.badRequest("VALIDATION_ERROR", "Secret value is required").toResponse();
  }

  const { encrypted, iv } = encryptSecret(secretPlaintext);
  const now = new Date().toISOString();

  const doc = await databases.createDocument(DB, COL, ID.unique(), {
    name: validated.data.name,
    category: validated.data.category ?? null,
    service_name: validated.data.serviceName ?? null,
    username: validated.data.username ?? null,
    secret_type: validated.data.secretType,
    url: validated.data.url ?? null,
    notes: validated.data.notes ?? null,
    tags: validated.data.tags ?? [],
    encrypted_value: encrypted,
    iv,
    key_version: 1,
    expires_at: validated.data.expiresAt ?? null,
    created_by: user.email ?? null,
    created_at: now,
    updated_at: now,
  });

  return Response.json({ id: doc.$id }, { status: 201 });
}
