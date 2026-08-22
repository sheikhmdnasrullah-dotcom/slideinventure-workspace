import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, createServiceClient } from '@/lib/supabase/server'
import { getMessage, markRead, deleteMessage } from '@/lib/mail/imap'

type Params = { params: Promise<{ id: string }> }

// id format: "{uid}|{folder}|{email}" e.g. "42|INBOX|hello@nasrullahtanim.me"
function parseId(id: string): { uid: number; folder: string; email: string } | null {
  const parts = decodeURIComponent(id).split('|')
  if (parts.length < 3) return null
  const uid = Number(parts[0])
  const folder = parts[1]
  const email = parts.slice(2).join('|')
  if (isNaN(uid) || !folder || !email) return null
  return { uid, folder, email }
}

// GET /api/mail/messages/[id] — full message
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = parseId(id)
  if (!parsed) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const message = await getMessage(parsed.email, parsed.folder, parsed.uid)
    if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Update cache
    const supabase = createServiceClient()
    await supabase.from('mail_messages').upsert({
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
    }, { onConflict: 'id' })

    return NextResponse.json(message)
  } catch (err) {
    console.error('[mail/messages/id GET]', err)
    return NextResponse.json({ error: 'Failed to fetch message' }, { status: 500 })
  }
}

// PATCH /api/mail/messages/[id] — mark read/unread
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = parseId(id)
  if (!parsed) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const read = Boolean(body.read)

  try {
    await markRead(parsed.email, parsed.folder, parsed.uid, read)

    // Update cache
    const supabase = createServiceClient()
    await supabase.from('mail_messages').update({ is_read: read }).eq('id', id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[mail/messages/id PATCH]', err)
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 })
  }
}

// DELETE /api/mail/messages/[id] — move to Trash (or expunge if already in Trash)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = parseId(id)
  if (!parsed) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    await deleteMessage(parsed.email, parsed.folder, parsed.uid)

    // Remove from cache
    const supabase = createServiceClient()
    await supabase.from('mail_messages').delete().eq('id', id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[mail/messages/id DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
  }
}
