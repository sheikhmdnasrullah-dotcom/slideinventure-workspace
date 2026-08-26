import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { databases } from '@/lib/appwrite/server'
import { ID, Query } from 'node-appwrite'
import { APPWRITE } from '@/lib/appwrite/config'
import { reindexChunks } from '@/lib/knowledge/reindex'

const DB = APPWRITE.databaseId
const COL = APPWRITE.collections.knowledgeItems

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge')

async function upsertItem(item: Record<string, unknown>): Promise<string> {
  const res = await databases.listDocuments(DB, COL, [
    Query.equal("slug", item.slug as string),
    Query.limit(1),
  ])
  if (res.documents.length > 0) {
    const id = res.documents[0].$id
    await databases.updateDocument(DB, COL, id, {
      ...item,
      updated_at: new Date().toISOString(),
    })
    return id
  }
  const now = new Date().toISOString()
  const doc = await databases.createDocument(DB, COL, ID.unique(), {
    ...item,
    created_at: now,
    updated_at: now,
  })
  return doc.$id
}

export async function syncKnowledge() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true })
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR)
  const mdFiles = files.filter(f => f.endsWith('.md'))

  let count = 0

  for (const file of mdFiles) {
    const slug = file.replace(/\.md$/, '')
    const fullPath = path.join(KNOWLEDGE_DIR, file)
    const content = fs.readFileSync(fullPath, 'utf-8')
    const parsed = matter(content)

    const data = parsed.data
    const body = parsed.content

    const type = data.category || 'note'
    const title = data.title || slug
    const source = data.source || 'filesystem'
    const status = data.status || 'proposed'
    const tags = data.tags || []
    const author = data.author || null

    const item = {
      item_id: slug,
      slug,
      type,
      title,
      body,
      content_path: `/knowledge/${file}`,
      content_type: 'markdown',
      status,
      source,
      author,
      tags: Array.isArray(tags) ? tags : [tags],
    }

    try {
      const id = await upsertItem(item)
      // Filesystem-synced items were previously invisible to semantic search
      // because they never reached LanceDB. Reindex best-effort.
      reindexChunks(id, body).catch(() => {})
      count++
    } catch (err) {
      console.error(`Failed to sync ${file}:`, err)
    }
  }

  // Optionally delete items in DB that no longer exist in filesystem
  const { documents: allItems } = await databases.listDocuments(DB, COL, [Query.limit(1000)])
  const slugsInFs = new Set(mdFiles.map(f => f.replace(/\.md$/, '')))
  for (const item of allItems) {
    if (!slugsInFs.has((item as any).slug)) {
      try {
        await databases.deleteDocument(DB, COL, item.$id)
      } catch {
        // ignore delete failures
      }
    }
  }

  return count
}

export async function addKnowledgeItem(data: {
  title: string
  body: string
  tags?: string[]
  category?: string
  source?: string
  author?: string
  contentType?: string
}) {
  // Generate a safe slug
  let slug = data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  if (!slug) slug = `item-${Date.now()}`

  // Ensure unique slug
  let uniqueSlug = slug
  let counter = 1
  while (true) {
    // Best-effort filesystem mirror (fails silently on read-only serverless FS)
    try {
      if (fs.existsSync(KNOWLEDGE_DIR)) {
        const candidate = path.join(KNOWLEDGE_DIR, `${uniqueSlug}.md`)
        if (fs.existsSync(candidate)) {
          uniqueSlug = `${slug}-${counter}`
          counter++
          continue
        }
      }
    } catch {
      // ignore FS errors
    }
    break
  }

  const frontmatter = {
    title: data.title,
    category: data.category || 'note',
    source: data.source || 'dashboard',
    tags: data.tags || [],
    author: data.author || 'system',
    status: 'proposed'
  }

  // Best-effort: mirror the item to the local knowledge directory. On Vercel's
  // read-only filesystem this is expected to fail, so we never throw here.
  try {
    if (!fs.existsSync(KNOWLEDGE_DIR)) {
      fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true })
    }
    const fullPath = path.join(KNOWLEDGE_DIR, `${uniqueSlug}.md`)
    const content = matter.stringify(data.body || '', frontmatter)
    fs.writeFileSync(fullPath, content, 'utf-8')
  } catch (err) {
    console.warn(`Skipping local filesystem mirror for ${uniqueSlug}:`, err)
  }

  // Sync to database — this is the source of truth for the running app.
  const item = {
    item_id: uniqueSlug,
    slug: uniqueSlug,
    type: frontmatter.category,
    title: frontmatter.title,
    body: data.body,
    content_path: `/knowledge/${uniqueSlug}.md`,
    content_type: data.contentType || 'markdown',
    status: frontmatter.status,
    source: frontmatter.source,
    author: frontmatter.author,
    tags: frontmatter.tags,
  }

  const id = await upsertItem(item)

  // Every other write path (ingest/publish/[id] update) reindexes chunks
  // right after writing the item — this one never did, so anything added
  // through the "Add Context" dialog was invisible to both lexical chunk
  // search and (now) semantic search. Best-effort: never block the add.
  reindexChunks(id, data.body || '').catch(() => {})

  return {
    id,
    slug: uniqueSlug,
    type: frontmatter.category,
    title: frontmatter.title,
    body: data.body,
    status: frontmatter.status,
    source: frontmatter.source,
    author: frontmatter.author,
    tags: frontmatter.tags,
    content_path: item.content_path,
    content_type: item.content_type,
  }
}
