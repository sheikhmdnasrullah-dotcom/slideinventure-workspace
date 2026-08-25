import { getSessionUser } from "@/lib/appwrite/auth"
import { databases } from "@/lib/appwrite/server"
import { APPWRITE } from "@/lib/appwrite/config"
import { ApiError, toJson } from "@/lib/api/errors"
import { checkRateLimit } from "@/lib/api/rate-limit"
import { validate } from "@/lib/api/validation"
import { z } from "zod"
import { NextRequest } from "next/server"

const DB = APPWRITE.databaseId
const COL = APPWRITE.collections.leads

const BulkSchema = z.object({
  action: z.enum(["delete", "update"]),
  ids: z.array(z.string().min(1)).min(1).max(100),
})

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  const body = await request.json().catch(() => ({}))
  const validated = validate(BulkSchema, body)

  try {
    if (validated.data.action === "delete") {
      for (const id of validated.data.ids) {
        try {
          await databases.deleteDocument(DB, COL, id)
        } catch (e) {
          if ((e as { code?: number })?.code !== 404) throw e
        }
      }
      return Response.json({ deleted: validated.data.ids.length })
    }

    if (validated.data.action === "update") {
      const rest = body as Record<string, unknown>
      const update: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() }
      if (update.custom_fields && typeof update.custom_fields !== "string") {
        update.custom_fields = JSON.stringify(update.custom_fields)
      }
      for (const id of validated.data.ids) {
        try {
          await databases.updateDocument(DB, COL, id, update)
        } catch (e) {
          if ((e as { code?: number })?.code !== 404) throw e
        }
      }
      return Response.json({ updated: validated.data.ids.length })
    }

    return ApiError.badRequest("UNSUPPORTED_ACTION", "Action must be 'delete' or 'update'").toResponse()
  } catch (error) {
    return toJson(error)
  }
}
