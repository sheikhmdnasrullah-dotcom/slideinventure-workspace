import { NextRequest, NextResponse } from 'next/server'
import { addKnowledgeItem } from '@/lib/knowledge/sync'
import { getSessionUser } from '@/lib/appwrite/auth'
import { extractFileText } from '@/lib/knowledge/file-extract'
import { classifyKnowledgeInput } from '@/lib/knowledge/classify'
import { logActivity } from '@/lib/activities/client'

function deriveTitleFromText(text?: string): string {
  if (!text) return ''
  const firstLine = text.split('\n').map(l => l.trim()).find(Boolean) || ''
  const heading = firstLine.replace(/^#+\s*/, '')
  return heading.slice(0, 80)
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      const title = (form.get('title') as string) || ''
      const categoryRaw = (form.get('category') as string) || ''
      const source = (form.get('source') as string) || 'upload'
      const tagsRaw = (form.get('tags') as string) || ''
      const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      const extracted = await extractFileText(file)
      const finalTitle = title.trim() || extracted.title || file.name
      // "auto"/blank means the user didn't pick a category — classify it
      // ourselves rather than blocking on a forced choice. A category the
      // user did pick is always respected as-is.
      const category = categoryRaw && categoryRaw !== 'auto'
        ? categoryRaw
        : await classifyKnowledgeInput(finalTitle, extracted.text)

      const item = await addKnowledgeItem({
        title: finalTitle,
        body: extracted.text,
        category,
        source,
        tags,
        author: user.email || 'user',
        contentType: extracted.contentType,
      })

      logActivity({
        category: "knowledge",
        action: "created",
        title: `Knowledge item created`,
        description: finalTitle,
        entityId: item.id,
        entityType: "knowledge",
        metadata: { category, source, contentType: extracted.contentType },
      }).catch(() => {})

      return NextResponse.json({ ok: true, item })
    }

    const body = await req.json()
    const { title, content, category: categoryRaw, tags, source } = body

    if (!title?.trim() && !content?.trim()) {
      return NextResponse.json({ error: 'Nothing to save. Provide some text or a file' }, { status: 400 })
    }

    const finalTitle = title?.trim() || deriveTitleFromText(content) || `Note: ${new Date().toLocaleDateString()}`
    const category = categoryRaw && categoryRaw !== 'auto'
      ? categoryRaw
      : await classifyKnowledgeInput(finalTitle, content || '')

    const item = await addKnowledgeItem({
      title: finalTitle,
      body: content || '',
      category,
      tags: tags || [],
      source,
      author: user.email || 'user',
      contentType: 'markdown',
    })

    logActivity({
      category: "knowledge",
      action: "created",
      title: `Knowledge item created`,
      description: finalTitle,
      entityId: item.id,
      entityType: "knowledge",
      metadata: { category, source, contentType: "markdown" },
    }).catch(() => {})

    return NextResponse.json({ ok: true, item })
  } catch (error) {
    console.error('Failed to add knowledge item:', error)
    return NextResponse.json({ error: 'Add failed' }, { status: 500 })
  }
}
