import { NextResponse } from 'next/server'
import { syncKnowledge } from '@/lib/knowledge/sync'
import { getSessionUser } from '@/lib/appwrite/auth'

export async function POST() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const count = await syncKnowledge()
    return NextResponse.json({ ok: true, count })
  } catch (error) {
    console.error('Failed to sync knowledge:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
