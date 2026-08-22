import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase/server'
import { sendMail } from '@/lib/mail/smtp'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { to, subject, body: messageBody, inReplyTo, references } = body as {
    to: string
    subject: string
    body: string
    inReplyTo?: string
    references?: string
  }

  if (!to || !subject || !messageBody) {
    return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 })
  }

  try {
    const result = await sendMail({ to, subject, body: messageBody, inReplyTo, references })
    return NextResponse.json({ ok: true, messageId: result.messageId })
  } catch (err) {
    console.error('[mail/send]', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
