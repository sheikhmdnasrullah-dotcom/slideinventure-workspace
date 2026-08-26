import { NextRequest } from "next/server"
import { getSessionUser } from "@/lib/appwrite/auth"
import { databases } from "@/lib/appwrite/server"
import { ID, Query } from "node-appwrite"
import { APPWRITE } from "@/lib/appwrite/config"
import { ApiError, toJson } from "@/lib/api/errors"
import { checkRateLimit } from "@/lib/api/rate-limit"

const DB = APPWRITE.databaseId
const COL = APPWRITE.collections.notes

type RawNote = {
  $id: string
  title?: string | null
  content?: string | null
  created_at?: string | null
  updated_at?: string | null
}

function serialize(doc: RawNote) {
  return {
    id: doc.$id,
    title: doc.title ?? null,
    content: doc.content ?? "",
    created_at: doc.created_at ?? "",
    updated_at: doc.updated_at ?? "",
  }
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(new NextRequest("http://x"), {
    limit: 60,
    windowMs: 60_000,
    identifier: `notes-list:${user.id}`,
  })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  try {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal("user_email", user.email ?? ""),
      Query.orderDesc("updated_at"),
    ])
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
    const now = new Date().toISOString()
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      user_email: user.email ?? "",
      title,
      content: typeof body.content === "string" ? body.content : "[]",
      created_at: now,
      updated_at: now,
    })
    return Response.json({ note: serialize(doc) }, { status: 201 })
  } catch (error) {
    return toJson(error)
  }
}
