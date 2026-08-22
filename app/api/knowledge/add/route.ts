import { NextRequest, NextResponse } from 'next/server'
import { addKnowledgeItem } from '@/lib/knowledge/sync'
import { requireUser } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { title, content, category, tags, source } = body

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    const item = await addKnowledgeItem({
      title,
      body: content,
      category,
      tags: tags || [],
      source,
      author: user.email || 'user'
    })

    return NextResponse.json({ ok: true, item })
  } catch (error) {
    console.error('Failed to add knowledge item:', error)
    return NextResponse.json({ error: 'Add failed' }, { status: 500 })
  }
}
