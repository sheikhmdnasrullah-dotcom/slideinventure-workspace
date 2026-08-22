import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase/server'
import { listFolders } from '@/lib/mail/imap'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const account = searchParams.get('account')
  if (!account) return NextResponse.json({ error: 'Missing account' }, { status: 400 })

  try {
    const folders = await listFolders(account)
    return NextResponse.json(folders)
  } catch (err) {
    console.error('[mail/folders]', err)
    return NextResponse.json({ error: 'Failed to list folders' }, { status: 500 })
  }
}
