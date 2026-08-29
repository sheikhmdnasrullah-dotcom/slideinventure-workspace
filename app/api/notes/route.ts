import { NextRequest } from "next/server"
import { getSessionUser } from "@/lib/appwrite/auth"
import { databases } from "@/lib/appwrite/server"
import { ID, Query } from "node-appwrite"
import { APPWRITE } from "@/lib/appwrite/config"
import { ApiError, toJson } from "@/lib/api/errors"
import { checkRateLimit } from "@/lib/api/rate-limit"
import { logActivity } from "@/lib/activities/client"
import { upsertVector } from "@/lib/retrieval/vector-index"
import { blockNoteToPlainText } from "@/lib/retrieval/blocknote-text"

const DB = APPWRITE.databaseId
const COL = APPWRITE.collections.notes

type RawNote = {
  $id: string
  title?: string | null
  content?: string | null
  scope?: string | null
  tags?: string[] | null
  links?: string[] | null
  created_at?: string | null
  updated_at?: string | null
}

function serialize(doc: RawNote) {
  return {
    id: doc.$id,
    title: doc.title ?? null,
    content: doc.content ?? "",
    scope: doc.scope || "global",
    tags: doc.tags ?? [],
    links: doc.links ?? [],
    created_at: doc.created_at ?? "",
    updated_at: doc.updated_at ?? "",
  }
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, {
    limit: 60,
    windowMs: 60_000,
    identifier: `notes-list:${user.id}`,
  })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  const scope = request.nextUrl.searchParams.get("scope")

  try {
    const queries = [Query.equal("user_email", user.email ?? ""), Query.orderDesc("updated_at")]
    if (scope) queries.push(Query.equal("scope", scope))
    const res = await databases.listDocuments(DB, COL, queries)
    return Response.json({ notes: res.documents.map(serialize) })
  } catch (error) {
    return toJson(error)
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, {
    limit: 20,
    windowMs: 60_000,
    identifier: `notes-create:${user.id}`,
  })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  try {
    const body = await request.json().catch(() => ({}) as Record<string, unknown>)
    const rawTitle = body.title
    const title =
      typeof rawTitle === "string" && rawTitle.trim().length > 0
        ? rawTitle.trim().slice(0, 200)
        : null
    const scope =
      body.scope === "ai-venture" ? "ai-venture" : body.scope === "brainstorm" ? "brainstorm" : "global"
    const now = new Date().toISOString()
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      user_email: user.email ?? "",
      title,
      content: typeof body.content === "string" ? body.content : "[]",
      scope,
      tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string").slice(0, 20) : [],
      links: Array.isArray(body.links) ? body.links.filter((l: unknown) => typeof l === "string").slice(0, 50) : [],
      created_at: now,
      updated_at: now,
    })

    // Every scope logs an activity. Previously only ai-venture notes did, so a
    // note created from /notepad or Brainstorm never reached the dashboard and
    // looked like nothing had happened.
    const CATEGORY_BY_SCOPE = {
      "ai-venture": "ai_venture",
      brainstorm: "brainstorm",
      global: "notes",
    } as const

    logActivity({
      category: CATEGORY_BY_SCOPE[scope],
      action: "created",
      title: "Note created",
      description: title || "Untitled note",
      entityId: doc.$id,
      entityType: "note",
      metadata: { scope },
    }).catch(() => {})

    if (scope !== "ai-venture") {
      // AI Venture notes are indexed by that section's own retrieval pass.
      const text = [title, blockNoteToPlainText(doc.content as string)].filter(Boolean).join("\n")
      upsertVector({ collection: "notes", docId: doc.$id, text }).catch(() => {})
    }

    return Response.json({ note: serialize(doc) }, { status: 201 })
  } catch (error) {
    return toJson(error)
  }
}
