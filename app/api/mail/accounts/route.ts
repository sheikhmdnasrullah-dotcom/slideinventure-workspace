import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase/server'
import { getPublicAccounts } from '@/lib/mail/accounts'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const accounts = getPublicAccounts()
    return NextResponse.json(accounts)
  } catch (err) {
    console.error('[mail/accounts]', err)
    return NextResponse.json({ error: 'Failed to list accounts' }, { status: 500 })
  }
}
