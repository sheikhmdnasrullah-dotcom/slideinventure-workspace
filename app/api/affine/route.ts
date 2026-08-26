import { getSessionUser } from "@/lib/appwrite/auth";
import { databases, ID } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
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

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const section = new URL(req.url).searchParams.get("section") ?? "brainstorm";
  await ensureAffineCollection();
  const res = await databases.listDocuments(DB, COL, [
    Query.equal("section", section),
    Query.equal("user_email", user.email ?? ""),
    Query.orderDesc("updated_at"),
    Query.limit(100),
  ]);
  return Response.json({ workspaces: res.documents.map(serialize) });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const section = body.section ?? "brainstorm";
  const title = (body.title ?? "Untitled").toString().trim() || "Untitled";
  await ensureAffineCollection();
  const doc = await databases.createDocument(DB, COL, ID.unique(), {
    section,
    title,
    snapshot: body.snapshot ? JSON.stringify(body.snapshot) : null,
    user_email: user.email ?? "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return Response.json({ workspace: serialize(doc) }, { status: 201 });
}
