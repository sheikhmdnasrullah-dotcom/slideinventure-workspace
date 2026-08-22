import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase/server'
import { getAccount } from '@/lib/mail/accounts'

// Attachment streaming — fetches raw part from IMAP and streams to client
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const accountEmail = searchParams.get('account')
  const folder = searchParams.get('folder') ?? 'INBOX'
  const uid = Number(searchParams.get('uid'))
  const part = searchParams.get('part') ?? '2'

  if (!accountEmail) return NextResponse.json({ error: 'Missing account' }, { status: 400 })
  if (!uid || isNaN(uid)) return NextResponse.json({ error: 'Invalid uid' }, { status: 400 })

  const account = getAccount(accountEmail)
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  try {
    const { ImapFlow } = await import('imapflow')
    const client = new ImapFlow({
      host: account.imapHost,
      port: account.imapPort,
      secure: false,
      auth: {
        user: account.email,
        pass: account.password,
      },
      logger: false,
    })

    await client.connect()
    await client.mailboxOpen(folder, { readOnly: true })

    const download = await client.download(String(uid), part, { uid: true })

    // Collect stream into buffer
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      download.content.on('data', (chunk: Buffer) => chunks.push(chunk))
      download.content.on('end', resolve)
      download.content.on('error', reject)
    })

    await client.logout()

    const data = Buffer.concat(chunks)
    const filename = download.meta.filename ?? `attachment-${part}`

    return new NextResponse(data, {
      headers: {
        'Content-Type': download.meta.contentType ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(data.length),
      },
    })
  } catch (err) {
    console.error('[mail/attachments]', err)
    return NextResponse.json({ error: 'Failed to download attachment' }, { status: 500 })
  }
}
