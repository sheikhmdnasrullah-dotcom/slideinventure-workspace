import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, createServiceClient } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getMessage, markRead, deleteMessage } from "@/lib/mail/imap";

type Params = { params: Promise<{ id: string }> };

function parseId(id: string): { uid: number; folder: string; email: string } | null {
  const parts = decodeURIComponent(id).split("|");
  if (parts.length < 3) return null;
  const uid = Number(parts[0]);
  const folder = parts[1];
  const email = parts.slice(2).join("|");
  if (isNaN(uid) || !folder || !email) return null;
  return { uid, folder, email };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(_req, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  const parsed = parseId(id);
  if (!parsed) return ApiError.badRequest("INVALID_ID", "Invalid message id format").toResponse();

  try {
    const message = await getMessage(parsed.email, parsed.folder, parsed.uid);
    if (!message) return ApiError.notFound("MESSAGE_NOT_FOUND", "Message not found").toResponse();

    const supabase = createServiceClient();
    await supabase.from("mail_messages").upsert(
      {
        id,
        uid: message.uid,
        folder: message.folder,
        from: message.from,
        from_name: message.fromName,
        to: message.to,
        cc: message.cc ?? [],
        subject: message.subject,
        body_text: message.text,
        body_html: message.html ?? null,
        sent_at: message.date,
        is_read: message.read,
        has_attachments: message.hasAttachments,
        message_id: message.messageId ?? null,
        in_reply_to: message.inReplyTo ?? null,
        labels: message.labels,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    return NextResponse.json(message);
  } catch (err) {
    return ApiError.internal("FETCH_ERROR", err instanceof Error ? err.message : "Failed to fetch message").toResponse();
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(req, { limit: 50, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  const parsed = parseId(id);
  if (!parsed) return ApiError.badRequest("INVALID_ID", "Invalid message id format").toResponse();

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const read = Boolean(body.read);

  try {
    await markRead(parsed.email, parsed.folder, parsed.uid, read);

    const supabase = createServiceClient();
    await supabase.from("mail_messages").update({ is_read: read }).eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return ApiError.internal("UPDATE_ERROR", err instanceof Error ? err.message : "Failed to update message").toResponse();
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(_req, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  const parsed = parseId(id);
  if (!parsed) return ApiError.badRequest("INVALID_ID", "Invalid message id format").toResponse();

  try {
    await deleteMessage(parsed.email, parsed.folder, parsed.uid);

    const supabase = createServiceClient();
    await supabase.from("mail_messages").delete().eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return ApiError.internal("DELETE_ERROR", err instanceof Error ? err.message : "Failed to delete message").toResponse();
  }
}
