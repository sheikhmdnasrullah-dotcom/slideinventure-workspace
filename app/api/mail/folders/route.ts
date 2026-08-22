import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase/server'
import { listFolders } from '@/lib/mail/imap'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const folders = await listFolders()
    return NextResponse.json(folders)
  } catch (err) {
    console.error('[mail/folders]', err)
    return NextResponse.json({ error: 'Failed to list folders' }, { status: 500 })
  }
}
