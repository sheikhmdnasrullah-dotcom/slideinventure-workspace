import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, createServiceClient } from '@/lib/supabase/server'
import { listMessages } from '@/lib/mail/imap'
import type { MailMessage } from '@/lib/mail/types'

// Cache messages in Supabase for fast subsequent loads and search
async function cacheMessages(messages: MailMessage[]) {
  if (messages.length === 0) return
  const supabase = createServiceClient()
  const rows = messages.map((m) => ({
    id: `${m.uid}@${m.folder}`,
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
  }))

  await supabase
    .from('mail_messages')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const folder = searchParams.get('folder') ?? 'INBOX'
  const search = searchParams.get('search') ?? ''
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)
  const cached = searchParams.get('cached') === 'true'

  // If caller wants cached (subsequent loads), query Supabase
  if (cached && !search) {
    const supabase = createServiceClient()
    let query = supabase
      .from('mail_messages')
      .select('*')
      .eq('folder', folder)
      .order('sent_at', { ascending: false })
      .limit(limit)

    if (search) {
      query = query.textSearch('fts', search, { type: 'plain' })
    }

    const { data, error } = await query
    if (!error && data && data.length > 0) {
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
      }))
      return NextResponse.json(messages)
    }
  }

  // Full-text search: query DB if we have cached data
  if (search && cached) {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('mail_messages')
      .select('*')
      .eq('folder', folder)
      .textSearch('fts', search, { type: 'plain' })
      .order('sent_at', { ascending: false })
      .limit(limit)

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
      }))
      return NextResponse.json(messages)
    }
  }

  // Live fetch from IMAP
  try {
    const messages = await listMessages(folder, limit, search || undefined)
    // Fire-and-forget cache write
    cacheMessages(messages).catch(console.error)
    return NextResponse.json(messages)
  } catch (err) {
    console.error('[mail/messages]', err)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}
