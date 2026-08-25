import { NextRequest, NextResponse } from 'next/server'
import { addKnowledgeItem } from '@/lib/knowledge/sync'
import { getSessionUser } from '@/lib/appwrite/auth'
import { extractFileText } from '@/lib/knowledge/file-extract'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      const title = (form.get('title') as string) || ''
      const category = (form.get('category') as string) || 'note'
      const source = (form.get('source') as string) || 'upload'
      const tagsRaw = (form.get('tags') as string) || ''
      const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      const extracted = await extractFileText(file)
      const finalTitle = title.trim() || extracted.title || file.name

      const item = await addKnowledgeItem({
        title: finalTitle,
        body: extracted.text,
        category,
        source,
        tags,
        author: user.email || 'user',
        contentType: extracted.contentType,
      })

      return NextResponse.json({ ok: true, item })
    }

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
      author: user.email || 'user',
      contentType: 'markdown',
    })

    return NextResponse.json({ ok: true, item })
  } catch (error) {
    console.error('Failed to add knowledge item:', error)
    return NextResponse.json({ error: 'Add failed' }, { status: 500 })
  }
}
