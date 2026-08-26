import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { UsefulLinkSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.usefulLinks;

type LinkDocument = Record<string, unknown> & {
  $id: string;
  url?: string;
};

function serialize(doc: LinkDocument) {
  const out: Record<string, unknown> = { id: doc.$id };
  for (const [k, v] of Object.entries(doc)) {
    if (k.startsWith("$")) continue;
    out[k] = v;
  }
  return out;
}

function buildFallbackTitle(url: string) {
  try {
    const parsed = new URL(url)
    return (parsed.hostname + parsed.pathname).replace(/\/$/, "")
  } catch {
    return url
  }
}

async function fetchOwned(id: string, email: string) {
  const res = await databases.listDocuments(DB, COL, [Query.equal("$id", id), Query.equal("created_by", email)]);
  return (res.documents[0] as LinkDocument | undefined) ?? null;
}

const UpdateSchema = UsefulLinkSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  try {
    const doc = await fetchOwned(id, user.email ?? "");
    if (!doc) return ApiError.notFound("LINK_NOT_FOUND", "Link not found").toResponse();
    return Response.json(serialize(doc));
  } catch (error) {
    return ApiError.internal("DB_ERROR", (error as Error).message).toResponse();
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  try {
    const doc = await fetchOwned(id, user.email ?? "");
    if (!doc) return ApiError.notFound("LINK_NOT_FOUND", "Link not found").toResponse();

    const body = await request.json().catch(() => ({}));
    const validated = validate(UpdateSchema, body);
    const d = validated.data;
    const now = new Date().toISOString();
    const nextUrl = d.url ?? doc.url;
    const nextTitle = d.title !== undefined || d.url !== undefined
      ? (d.title?.trim() || buildFallbackTitle(nextUrl))
      : undefined;

    const payload: Record<string, unknown> = { updated_at: now };
    if (d.url !== undefined) payload.url = d.url;
    if (nextTitle !== undefined) payload.title = nextTitle;
    if (d.description !== undefined) payload.description = d.description;
    if (d.tags !== undefined) payload.tags = d.tags;
    if (d.favicon !== undefined) payload.favicon = d.favicon;

    await databases.updateDocument(DB, COL, id, payload);
    return Response.json({ id, status: "updated" });
  } catch (error) {
    return ApiError.internal("DB_ERROR", (error as Error).message).toResponse();
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  try {
    const doc = await fetchOwned(id, user.email ?? "");
    if (!doc) return ApiError.notFound("LINK_NOT_FOUND", "Link not found").toResponse();

    await databases.deleteDocument(DB, COL, id);
    return Response.json({ id, status: "deleted" });
  } catch (error) {
    return ApiError.internal("DB_ERROR", (error as Error).message).toResponse();
  }
}
