import { NextRequest } from "next/server"
import { getSessionUser } from "@/lib/appwrite/auth"
import { databases } from "@/lib/appwrite/server"
import { Query } from "node-appwrite"
import { APPWRITE } from "@/lib/appwrite/config"
import { ApiError, toJson } from "@/lib/api/errors"
import { checkRateLimit } from "@/lib/api/rate-limit"

const DB = APPWRITE.databaseId
const COL = APPWRITE.collections.researchWorkspaces

function serialize(doc: Record<string, unknown>) {
  return {
    id: doc.$id,
    title: doc.title || "Untitled Research",
    scope: doc.scope || "global",
    content: doc.content ?? "{}",
    documentIds: doc.document_ids ?? [],
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}

async function fetchOwned(id: string, email: string) {
  const res = await databases.listDocuments(DB, COL, [Query.equal("$id", id), Query.equal("user_email", email)])
  return res.documents[0] ?? null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const { id } = await params
  const doc = await fetchOwned(id, user.email ?? "")
  if (!doc) return ApiError.notFound("RESEARCH_NOT_FOUND", "Research workspace not found").toResponse()
  return Response.json(serialize(doc))
}

// Every field optional — a title-only rename and a canvas-only autosave are
// both valid, cheap requests. Nothing here is ever required to save.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, { limit: 120, windowMs: 60_000, identifier: `research-save:${user.id}` })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  const { id } = await params
  const existing = await fetchOwned(id, user.email ?? "")
  if (!existing) return ApiError.notFound("RESEARCH_NOT_FOUND", "Research workspace not found").toResponse()

  try {
    const body = await request.json().catch(() => ({}))
    const { title, content, documentIds } = body as { title?: string; content?: string; documentIds?: string[] }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (title !== undefined) patch.title = title.trim() || "Untitled Research"
    if (content !== undefined) patch.content = content
    if (documentIds !== undefined) patch.document_ids = documentIds

    const updated = await databases.updateDocument(DB, COL, id, patch)
    return Response.json(serialize(updated))
  } catch (error) {
    return toJson(error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000, identifier: `research-delete:${user.id}` })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  const { id } = await params
  const existing = await fetchOwned(id, user.email ?? "")
  if (!existing) return ApiError.notFound("RESEARCH_NOT_FOUND", "Research workspace not found").toResponse()

  try {
    await databases.deleteDocument(DB, COL, id)
    return Response.json({ id, status: "deleted" })
  } catch (error) {
    return toJson(error)
  }
}
