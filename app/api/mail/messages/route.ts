import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import {  ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery } from "@/lib/api/validation";
import { z } from "zod";
import { listMessages } from "@/lib/mail/imap";
import type { MailMessage } from "@/lib/mail/types";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.mailMessages;

const ListSchema = z.object({
  account: z.string().min(1, "account is required"),
  folder: z.string().default("INBOX"),
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  cached: z.coerce.boolean().optional(),
});

function toMailMessage(doc: Record<string, any>): MailMessage {
  return {
    id: doc.message_uid,
    uid: doc.uid,
    folder: doc.folder,
    from: doc.from,
    fromName: doc.from_name,
    to: doc.to ?? [],
    cc: doc.cc,
    subject: doc.subject ?? "",
    text: doc.body_text ?? "",
    html: doc.body_html ?? undefined,
    date: doc.sent_at,
    read: doc.is_read,
    labels: doc.labels ?? [],
    hasAttachments: doc.has_attachments,
    messageId: doc.message_id ?? undefined,
    inReplyTo: doc.in_reply_to ?? undefined,
  };
}

async function upsertMessage(m: MailMessage, account: string) {
  const payload = {
    uid: m.uid,
    folder: m.folder,
    from: m.from,
    from_name: m.fromName,
    to: m.to,
    cc: m.cc ?? [],
    subject: m.subject,
    body_text: m.text,
    body_html: m.html ?? null,
    sent_at: m.date,
    is_read: m.read,
    has_attachments: m.hasAttachments,
    message_id: m.messageId ?? null,
    in_reply_to: m.inReplyTo ?? null,
    labels: m.labels,
    fetched_at: new Date().toISOString(),
    account,
    message_uid: m.id,
  };
  const existing = await databases.listDocuments(DB, COL, [Query.equal("message_uid", m.id)]);
  if (existing.documents.length > 0) {
    await databases.updateDocument(DB, COL, existing.documents[0].$id, payload);
  } else {
    await databases.createDocument(DB, COL, ID.unique(), payload);
  }
}

async function cacheMessages(messages: MailMessage[], account: string) {
  if (messages.length === 0) return;
  await Promise.all(messages.map((m) => upsertMessage(m, account).catch(console.error)));
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);

  const account = query.data.account;
  const folder = query.data.folder;
  const search = query.data.search;
  const pageLimit = query.data.limit;
  const cached = query.data.cached ?? false;

  if (cached && !search) {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal("account", account),
      Query.equal("folder", folder),
      Query.orderDesc("sent_at"),
      Query.limit(pageLimit),
    ]);
    if (res.documents.length > 0) {
      return NextResponse.json(res.documents.map(toMailMessage));
    }
  }

  if (search && cached) {
    const searches = await Promise.all([
      databases.listDocuments(DB, COL, [Query.equal("account", account), Query.equal("folder", folder), Query.search("subject", search), Query.limit(1000)]),
      databases.listDocuments(DB, COL, [Query.equal("account", account), Query.equal("folder", folder), Query.search("body_text", search), Query.limit(1000)]),
      databases.listDocuments(DB, COL, [Query.equal("account", account), Query.equal("folder", folder), Query.search("from_name", search), Query.limit(1000)]),
      databases.listDocuments(DB, COL, [Query.equal("account", account), Query.equal("folder", folder), Query.search("from", search), Query.limit(1000)]),
    ]);
    const map = new Map<string, Record<string, any>>();
    for (const res of searches) for (const d of res.documents) if (!map.has(d.$id)) map.set(d.$id, d);
    const docs = [...map.values()].sort(
      (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    );
    if (docs.length > 0) {
      return NextResponse.json(docs.slice(0, pageLimit).map(toMailMessage));
    }
  }

  try {
    const messages = await listMessages(account, folder, pageLimit, search || undefined);
    cacheMessages(messages, account).catch(console.error);
    return NextResponse.json(messages);
  } catch (err) {
    return ApiError.internal("FETCH_ERROR", err instanceof Error ? err.message : "Failed to fetch messages").toResponse();
  }
}
