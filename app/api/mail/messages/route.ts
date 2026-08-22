import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, createServiceClient } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery } from "@/lib/api/validation";
import { z } from "zod";
import { listMessages } from "@/lib/mail/imap";
import type { MailMessage } from "@/lib/mail/types";

const ListSchema = z.object({
  account: z.string().min(1, "account is required"),
  folder: z.string().default("INBOX"),
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  cached: z.coerce.boolean().optional(),
});

async function cacheMessages(messages: MailMessage[]) {
  if (messages.length === 0) return;
  const supabase = createServiceClient();
  const rows = messages.map((m) => ({
    id: m.id,
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
  }));

  await supabase.from("mail_messages").upsert(rows, { onConflict: "id", ignoreDuplicates: false });
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return toJson(ApiError.unauthorized());

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return toJson(ApiError.rateLimited());

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);
  const supabase = createServiceClient();

  const account = query.data.account;
  const folder = query.data.folder;
  const search = query.data.search;
  const pageLimit = query.data.limit;
  const cached = query.data.cached ?? false;

  if (cached && !search) {
    const { data } = await supabase
      .from("mail_messages")
      .select("*")
      .eq("folder", folder)
      .like("id", `%|${account}`)
      .order("sent_at", { ascending: false })
      .limit(pageLimit);

    if (data && data.length > 0) {
      const messages: MailMessage[] = data.map((row) => ({
        id: row.id,
        uid: row.uid,
        folder: row.folder,
        from: row.from,
        fromName: row.from_name,
        to: row.to,
        cc: row.cc,
        subject: row.subject,
        text: row.body_text,
        html: row.body_html,
        date: row.sent_at,
        read: row.is_read,
        labels: row.labels,
        hasAttachments: row.has_attachments,
        messageId: row.message_id,
        inReplyTo: row.in_reply_to,
      }));
      return NextResponse.json(messages);
    }
  }

  if (search && cached) {
    const { data } = await supabase
      .from("mail_messages")
      .select("*")
      .eq("folder", folder)
      .like("id", `%|${account}`)
      .textSearch("fts", search, { type: "plain" })
      .order("sent_at", { ascending: false })
      .limit(pageLimit);

    if (data && data.length > 0) {
      const messages: MailMessage[] = data.map((row) => ({
        id: row.id,
        uid: row.uid,
        folder: row.folder,
        from: row.from,
        fromName: row.from_name,
        to: row.to,
        cc: row.cc,
        subject: row.subject,
        text: row.body_text,
        html: row.body_html,
        date: row.sent_at,
        read: row.is_read,
        labels: row.labels,
        hasAttachments: row.has_attachments,
        messageId: row.message_id,
        inReplyTo: row.in_reply_to,
      }));
      return NextResponse.json(messages);
    }
  }

  try {
    const messages = await listMessages(account, folder, pageLimit, search || undefined);
    cacheMessages(messages).catch(console.error);
    return NextResponse.json(messages);
  } catch (err) {
    return toJson(ApiError.internal("FETCH_ERROR", err instanceof Error ? err.message : "Failed to fetch messages"));
  }
}
