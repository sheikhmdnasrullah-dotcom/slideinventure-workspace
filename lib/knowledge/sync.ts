import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { createServiceClient } from '@/lib/supabase/server'

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge')

export async function syncKnowledge() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true })
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR)
  const mdFiles = files.filter(f => f.endsWith('.md'))

  const supabase = createServiceClient()

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
      id: slug, // using slug as id for simplicity
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
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('knowledge_items')
      .upsert(item, { onConflict: 'slug' })

    if (error) {
      console.error(`Failed to sync ${file}:`, error)
    } else {
      count++
    }
  }

  // Optionally delete items in DB that no longer exist in filesystem
  // For safety, we might not want to automatically delete them unless specified, 
  // but for strict sync we should.
  const { data: allItems } = await supabase.from('knowledge_items').select('slug')
  if (allItems) {
    const slugsInFs = new Set(mdFiles.map(f => f.replace(/\.md$/, '')))
    for (const item of allItems) {
      if (!slugsInFs.has(item.slug)) {
        await supabase.from('knowledge_items').delete().eq('slug', item.slug)
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
}) {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true })
  }

  // Generate a safe slug
  let slug = data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  
  // Ensure unique slug
  let fullPath = path.join(KNOWLEDGE_DIR, `${slug}.md`)
  let counter = 1
  while (fs.existsSync(fullPath)) {
    slug = `${slug}-${counter}`
    fullPath = path.join(KNOWLEDGE_DIR, `${slug}.md`)
    counter++
  }

  const frontmatter = {
    title: data.title,
    category: data.category || 'note',
    source: data.source || 'dashboard',
    tags: data.tags || [],
    author: data.author || 'system',
    status: 'proposed'
  }

  const content = matter.stringify(data.body || '', frontmatter)
  fs.writeFileSync(fullPath, content, 'utf-8')

  // Sync to database
  const supabase = createServiceClient()
  const item = {
    id: slug,
    slug,
    type: frontmatter.category,
    title: frontmatter.title,
    body: data.body,
    content_path: `/knowledge/${slug}.md`,
    content_type: 'markdown',
    status: frontmatter.status,
    source: frontmatter.source,
    author: frontmatter.author,
    tags: frontmatter.tags,
    updated_at: new Date().toISOString()
  }

  const { error } = await supabase
    .from('knowledge_items')
    .upsert(item, { onConflict: 'slug' })

  if (error) {
    console.error(`Failed to insert to DB for ${slug}:`, error)
    throw new Error('Database sync failed')
  }

  return item
}
