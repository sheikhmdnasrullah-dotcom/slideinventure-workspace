import { getSessionUser } from "@/lib/appwrite/auth";
import { databases, ID } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { ensureAffineCollection } from "@/lib/affine/ensure";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.affineWorkspaces;

function serialize(d: any) {
  return {
    id: d.$id,
    section: d.section,
    title: d.title ?? "Untitled",
    snapshot: d.snapshot ? safeParse(d.snapshot) : null,
    updated_at: d.updated_at,
  };
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureAffineCollection();
  try {
    const doc = await databases.getDocument(DB, COL, id);
    return Response.json({ workspace: serialize(doc) });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  await ensureAffineCollection();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") update.title = body.title;
  if (body.snapshot !== undefined) update.snapshot = body.snapshot ? JSON.stringify(body.snapshot) : null;
  try {
    const doc = await databases.updateDocument(DB, COL, id, update);
    return Response.json({ workspace: serialize(doc) });
  } catch {
    return Response.json({ error: "Update failed" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureAffineCollection();
  try {
    await databases.deleteDocument(DB, COL, id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Delete failed" }, { status: 404 });
  }
}
