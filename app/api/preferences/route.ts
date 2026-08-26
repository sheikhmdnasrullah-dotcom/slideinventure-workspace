import { NextRequest } from "next/server"
import { z } from "zod"

import { getSessionUser } from "@/lib/appwrite/auth"
import { ApiError, toJson } from "@/lib/api/errors"
import { checkRateLimit } from "@/lib/api/rate-limit"
import { validate } from "@/lib/api/validation"
import {
  getDashboardPreferencesForUser,
  upsertDashboardPreferencesForUser,
} from "@/lib/dashboard/preferences.server"
import { mergeNavigationOrder } from "@/lib/dashboard/navigation"

const UpdatePreferencesSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).optional(),
  defaultLandingPage: z.string().optional(),
  navigationOrder: z.array(z.string()).optional(),
})

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  try {
    const preferences = await getDashboardPreferencesForUser(user.email)
    return Response.json({ data: preferences })
  } catch (error) {
    return toJson(ApiError.internal("PREFERENCES_READ_FAILED", (error as Error).message))
  }
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  const body = await request.json().catch(() => ({}))

  try {
    const validated = validate(UpdatePreferencesSchema, body)
    const preferences = await upsertDashboardPreferencesForUser(user.email, {
      theme: validated.data.theme,
      defaultLandingPage: validated.data.defaultLandingPage,
      navigationOrder: validated.data.navigationOrder
        ? mergeNavigationOrder(validated.data.navigationOrder)
        : undefined,
    })
    return Response.json({ data: preferences, status: "updated" })
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse()
    return toJson(ApiError.internal("PREFERENCES_WRITE_FAILED", (error as Error).message))
  }
}
