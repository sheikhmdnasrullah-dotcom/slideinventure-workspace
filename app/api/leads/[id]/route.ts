import { getSessionUser } from "@/lib/appwrite/auth"
import { databases } from "@/lib/appwrite/server"
import { Query } from "node-appwrite"
import { APPWRITE } from "@/lib/appwrite/config"
import { ApiError, toJson } from "@/lib/api/errors"
import { checkRateLimit } from "@/lib/api/rate-limit"
import { validate } from "@/lib/api/validation"
import { LeadSchema } from "@/lib/api/schemas"
import { recordAudit } from "@/lib/api/audit"
import { NextRequest } from "next/server"
import { serializeLead, leadInputToRow } from "@/lib/leads/mapping"

const DB = APPWRITE.databaseId
const COL = APPWRITE.collections.leads

const UpdateSchema = LeadSchema.partial().omit({ id: true, createdAt: true, updatedAt: true })

async function fetchLead(id: string) {
  const res = await databases.listDocuments(DB, COL, [Query.equal("$id", id)])
  return res.documents[0] ?? null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const { id } = await params
  try {
    const doc = await fetchLead(id)
    if (!doc) return ApiError.notFound("LEAD_NOT_FOUND", "Lead not found").toResponse()
    return Response.json(serializeLead(doc))
  } catch (error) {
    return toJson(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const validated = validate(UpdateSchema, body)

  try {
    const existing = await fetchLead(id)
    if (!existing) return ApiError.notFound("LEAD_NOT_FOUND", "Lead not found").toResponse()

    const now = new Date().toISOString()
    // first_name/last_name/source/status/tags/custom_fields all default in
    // LeadSchema, so validated.data always has them "defined" even when the
    // request omitted them. leadInputToRow's `!== undefined` checks can't
    // tell the difference. Strip any key the raw body didn't actually send
    // before handing off, so an omitted field is left untouched.
    const sanitized: Record<string, unknown> = { ...validated.data }
    for (const key of Object.keys(sanitized)) {
      if (!(key in (body as Record<string, unknown>))) delete sanitized[key]
    }
    await databases.updateDocument(DB, COL, id, {
      ...leadInputToRow(sanitized as typeof validated.data),
      updated_at: now,
    })

    await recordAudit({
      table: "leads",
      recordId: id,
      action: "update",
      diff: { before: serializeLead(existing), after: validated.data },
      actor: { userEmail: user.email ?? undefined, userId: user.id },
    })

    return Response.json({ id, status: "updated" })
  } catch (error) {
    return toJson(error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  const { id } = await params
  try {
    const existing = await fetchLead(id)
    if (!existing) return ApiError.notFound("LEAD_NOT_FOUND", "Lead not found").toResponse()

    await recordAudit({
      table: "leads",
      recordId: id,
      action: "delete",
      actor: { userEmail: user.email ?? undefined, userId: user.id },
    })

    await databases.deleteDocument(DB, COL, id)
    return Response.json({ id, status: "deleted" })
  } catch (error) {
    return toJson(error)
  }
}
