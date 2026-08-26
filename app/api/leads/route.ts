import { getSessionUser } from "@/lib/appwrite/auth"
import { databases } from "@/lib/appwrite/server"
import { ID, Query, type Models } from "node-appwrite"
import { APPWRITE } from "@/lib/appwrite/config"
import { ApiError, toJson } from "@/lib/api/errors"
import { checkRateLimit } from "@/lib/api/rate-limit"
import { validateQuery, validate } from "@/lib/api/validation"
import { z } from "zod"
import { LeadSchema } from "@/lib/api/schemas"
import { recordAudit } from "@/lib/api/audit"
import { NextRequest } from "next/server"
import { serializeLead, leadInputToRow } from "@/lib/leads/mapping"

const DB = APPWRITE.databaseId
const COL = APPWRITE.collections.leads

const SORTABLE = new Set(["created_at", "email", "status"])

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(10000).default(20),
  sortBy: z.string().default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
})

const CreateSchema = LeadSchema.omit({ id: true, createdAt: true, updatedAt: true }).refine(
  (data) => Boolean(data.first_name?.trim() || data.last_name?.trim() || data.email?.trim() || data.company?.trim()),
  { message: "Add at least a name, email, or company so this lead can be identified", path: ["first_name"] }
)

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 })
  if (!limit.allowed) return ApiError.rateLimited("RATE_LIMITED", "Too many requests", Math.ceil(limit.resetAt / 1000)).toResponse()

  const query = validateQuery(ListSchema, request.nextUrl.searchParams)

  const queries: string[] = []
  if (query.data.search) {
    const term = query.data.search
    queries.push(
      Query.or([
        Query.contains("first_name", term),
        Query.contains("last_name", term),
        Query.contains("email", term),
        Query.contains("company", term),
      ])
    )
  }
  if (query.data.status) queries.push(Query.equal("status", query.data.status))
  if (query.data.source) queries.push(Query.equal("source", query.data.source))

  const sortAttr = SORTABLE.has(query.data.sortBy) ? query.data.sortBy : "created_at"
  queries.push(query.data.sortOrder === "asc" ? Query.orderAsc(sortAttr) : Query.orderDesc(sortAttr))

  const from = (query.data.page - 1) * query.data.pageSize
  const to = from + query.data.pageSize

  try {
    const documents: Models.Document[] = []
    let total = 0
    let offset = from
    while (offset < to) {
      const chunkLimit = Math.min(100, to - offset)
      const chunkQueries = [...queries, Query.limit(chunkLimit), Query.offset(offset)]
      const res = await databases.listDocuments(DB, COL, chunkQueries)
      if (offset === from) total = res.total
      documents.push(...res.documents)
      if (res.documents.length < chunkLimit) break
      offset += chunkLimit
    }

    return Response.json({
      data: documents.map(serializeLead),
      total,
      page: query.data.page,
      pageSize: query.data.pageSize,
    })
  } catch (error) {
    return toJson(error)
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  const body = await request.json().catch(() => ({}))
  const validated = validate(CreateSchema, body)

  const now = new Date().toISOString()
  const id = ID.unique()

  try {
    await databases.createDocument(DB, COL, id, {
      ...leadInputToRow(validated.data),
      created_at: now,
      updated_at: now,
    })

    await recordAudit({
      table: "leads",
      recordId: id,
      action: "insert",
      diff: validated.data,
      actor: { userEmail: user.email ?? undefined, userId: user.id },
    })

    return Response.json({ id, status: "created" }, { status: 201 })
  } catch (error) {
    return toJson(error)
  }
}
