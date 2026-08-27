import { NextRequest, NextResponse } from "next/server";
import { databases, Query } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ensureNotificationsCollection } from "@/lib/notifications/ensure";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.notifications;

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureNotificationsCollection();

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";

  const queries = [
    Query.equal("user_email", user.email ?? ""),
    Query.orderDesc("created_at"),
    Query.limit(50),
  ];
  if (unreadOnly) queries.push(Query.equal("read", false));

  const res = await databases.listDocuments(DB, COL, queries);
  const items = res.documents.map((d) => ({
    id: d.$id,
    category: d.category,
    title: d.title,
    description: d.description,
    entityId: d.entity_id,
    entityType: d.entity_type,
    read: d.read,
    createdAt: d.created_at,
  }));
  const unread = res.documents.filter((d) => !d.read).length;
  return NextResponse.json({ notifications: items, unread });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureNotificationsCollection();

  const body = await req.json().catch(() => ({}));
  const email = user.email ?? "";

  if (body.all) {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal("user_email", email),
      Query.equal("read", false),
      Query.limit(100),
    ]);
    for (const d of res.documents) {
      try {
        await databases.updateDocument(DB, COL, d.$id, { read: true });
      } catch {
        /* ignore */
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    // only allow marking own notifications
    const doc = await databases.getDocument(DB, COL, body.id).catch(() => null);
    if (!doc || doc.user_email !== email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await databases.updateDocument(DB, COL, body.id, { read: true });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}

async function listOwned(email: string, unreadOnly = false) {
  const queries = [
    Query.equal("user_email", email),
    Query.limit(100),
  ];
  if (unreadOnly) queries.push(Query.equal("read", false));
  const res = await databases.listDocuments(DB, COL, queries);
  return res.documents;
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureNotificationsCollection();

  const body = await req.json().catch(() => ({}));
  const email = user.email ?? "";

  if (body.all) {
    const docs = await listOwned(email, true);
    for (const d of docs) {
      try {
        await databases.updateDocument(DB, COL, d.$id, { read: true });
      } catch {
        /* ignore */
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    const doc = await databases.getDocument(DB, COL, body.id).catch(() => null);
    if (!doc || doc.user_email !== email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await databases.updateDocument(DB, COL, body.id, { read: true });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureNotificationsCollection();

  const body = await req.json().catch(() => ({}));
  const email = user.email ?? "";

  if (body.all) {
    const docs = await listOwned(email);
    for (const d of docs) {
      try {
        await databases.deleteDocument(DB, COL, d.$id);
      } catch {
        /* ignore */
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    const doc = await databases.getDocument(DB, COL, body.id).catch(() => null);
    if (!doc || doc.user_email !== email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await databases.deleteDocument(DB, COL, body.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
