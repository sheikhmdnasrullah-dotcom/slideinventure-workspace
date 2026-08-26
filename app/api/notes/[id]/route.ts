import { NextRequest } from "next/server"
import { getSessionUser } from "@/lib/appwrite/auth"
import { databases, storage } from "@/lib/appwrite/server"
import { Query } from "node-appwrite"
import { APPWRITE } from "@/lib/appwrite/config"
import { ApiError, toJson } from "@/lib/api/errors"
import { checkRateLimit } from "@/lib/api/rate-limit"
import { logActivity } from "@/lib/activities/client"

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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const { id } = await params
  try {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal("$id", id),
      Query.equal("user_email", user.email ?? ""),
    ])
    if (res.documents.length === 0) return ApiError.notFound().toResponse()
    return Response.json({ note: serialize(res.documents[0]) })
  } catch (error) {
    return toJson(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, {
    limit: 30,
    windowMs: 60_000,
    identifier: `notes-update:${user.id}`,
  })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  const { id } = await params
  try {
    const body = await request.json().catch(() => ({}) as Record<string, unknown>)
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const title = body.title
    const content = body.content
    if (typeof title === "string") update.title = title.toString().slice(0, 200)
    if (typeof content === "string") update.content = content

    const res = await databases.listDocuments(DB, COL, [
      Query.equal("$id", id),
      Query.equal("user_email", user.email ?? ""),
    ])
    if (res.documents.length === 0) return ApiError.notFound().toResponse()

    const doc = await databases.updateDocument(DB, COL, id, update)
    logActivity({
      category: "notes",
      action: "updated",
      title: `Note updated`,
      description: (doc.title as string | null) ?? "Untitled",
      entityId: id,
      entityType: "note",
    }).catch(() => {})
    return Response.json({ note: serialize(doc) })
  } catch (error) {
    return toJson(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const { id } = await params
  try {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal("$id", id),
      Query.equal("user_email", user.email ?? ""),
    ])
    if (res.documents.length === 0) return ApiError.notFound().toResponse()

    // Best-effort: remove any images embedded in the note so they don't
    // linger as orphaned blobs in the files bucket.
    const content = (res.documents[0]?.content as string | undefined) ?? ""
    const fileIds = Array.from(
      content.matchAll(/storage\/buckets\/files\/files\/([^/?]+)/g)
    ).map((match) => match[1])
    for (const fileId of fileIds) {
      try {
        await storage.deleteFile("files", fileId)
      } catch {
        // ignore — the note row is being removed regardless
      }
    }

    await databases.deleteDocument(DB, COL, id)
    logActivity({
      category: "notes",
      action: "deleted",
      title: `Note deleted`,
      description: id,
      entityId: id,
      entityType: "note",
    }).catch(() => {})
    return Response.json({ ok: true })
  } catch (error) {
    return toJson(error)
  }
}
