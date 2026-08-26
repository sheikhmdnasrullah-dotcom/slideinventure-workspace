import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { TerminalCommandSchema } from "@/lib/api/schemas";
import { NextRequest } from "next/server";
import { upsertVector, deleteVector } from "@/lib/retrieval/vector-index";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.terminalCommands;

const JSON_KEYS = ["metadata", "variables"];

type TerminalDocument = Record<string, unknown> & {
  $id: string;
};

function serialize(doc: TerminalDocument) {
  const out: Record<string, unknown> = { id: doc.$id };
  for (const [k, v] of Object.entries(doc)) {
    if (k.startsWith("$")) continue;
    out[k] = JSON_KEYS.includes(k) && typeof v === "string" ? JSON.parse(v) : v;
  }
  return out;
}

async function fetchOwned(id: string, email: string) {
  const res = await databases.listDocuments(DB, COL, [Query.equal("$id", id), Query.equal("triggered_by", email)]);
  return (res.documents[0] as TerminalDocument | undefined) ?? null;
}

const UpdateSchema = TerminalCommandSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const { id } = await params;
  try {
    const doc = await fetchOwned(id, user.email ?? "");
    if (!doc) return ApiError.notFound("COMMAND_NOT_FOUND", "Command not found").toResponse();
    return Response.json(serialize(doc));
  } catch (error) {
    return toJson(ApiError.internal("DB_ERROR", (error as Error).message));
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
    if (!doc) return ApiError.notFound("COMMAND_NOT_FOUND", "Command not found").toResponse();

    const body = await request.json().catch(() => ({}));
    const validated = validate(UpdateSchema, body);
    const d = validated.data;
    const now = new Date().toISOString();

    const payload: Record<string, unknown> = { updated_at: now };
    if (d.title !== undefined) payload.title = d.title;
    if (d.command !== undefined) payload.command = d.command;
    if (d.description !== undefined) payload.description = d.description;
    if (d.category !== undefined) payload.category = d.category;
    if (d.tags !== undefined) payload.tags = d.tags;
    if (d.notes !== undefined) payload.notes = d.notes;
    if (d.variables !== undefined) payload.variables = JSON.stringify(d.variables);
    if (d.favorite !== undefined) payload.favorite = d.favorite;
    if (d.cwd !== undefined) payload.cwd = d.cwd;
    if (d.stdout !== undefined) payload.stdout = d.stdout;
    if (d.stderr !== undefined) payload.stderr = d.stderr;
    payload.triggered_by = user.email ?? doc.triggered_by ?? null;
    if (d.exitCode !== undefined) payload.exit_code = d.exitCode;
    if (d.durationMs !== undefined) payload.duration_ms = d.durationMs;
    if (d.metadata !== undefined) payload.metadata = JSON.stringify(d.metadata);

    await databases.updateDocument(DB, COL, id, payload);

    const text = [payload.title ?? doc.title, payload.command ?? doc.command, payload.description ?? doc.description, payload.notes ?? doc.notes]
      .filter(Boolean)
      .join("\n");
    upsertVector({ collection: "terminal", docId: id, text }).catch(() => {});

    return Response.json({ id, status: "updated" });
  } catch (error) {
    return toJson(ApiError.internal("DB_ERROR", (error as Error).message));
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
    if (!doc) return ApiError.notFound("COMMAND_NOT_FOUND", "Command not found").toResponse();

    await databases.deleteDocument(DB, COL, id);
    deleteVector({ collection: "terminal", docId: id }).catch(() => {});
    return Response.json({ id, status: "deleted" });
  } catch (error) {
    return toJson(ApiError.internal("DB_ERROR", (error as Error).message));
  }
}
