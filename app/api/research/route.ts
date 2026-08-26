import { NextRequest } from "next/server"
import { getSessionUser } from "@/lib/appwrite/auth"
import { databases } from "@/lib/appwrite/server"
import { ID, Query } from "node-appwrite"
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
    documentIds: doc.document_ids ?? [],
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}

// Global view = every research workspace regardless of scope. AI Venture
// view = only scope="ai-venture" ones. Same underlying rows either way —
// one brain, two lenses, not two databases.
export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, { limit: 60, windowMs: 60_000, identifier: `research-list:${user.id}` })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  const scope = request.nextUrl.searchParams.get("scope")

  try {
    const queries = [Query.equal("user_email", user.email ?? ""), Query.orderDesc("updated_at"), Query.limit(200)]
    if (scope) queries.push(Query.equal("scope", scope))
    const res = await databases.listDocuments(DB, COL, queries)
    return Response.json({ workspaces: res.documents.map(serialize) })
  } catch (error) {
    return toJson(error)
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000, identifier: `research-create:${user.id}` })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  try {
    const body = await request.json().catch(() => ({}))
    const scope = body?.scope === "ai-venture" ? "ai-venture" : "global"
    const now = new Date().toISOString()

    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      user_email: user.email ?? "",
      title: "Untitled Research",
      scope,
      content: "{}",
      document_ids: [],
      created_at: now,
      updated_at: now,
    })

    return Response.json({ workspace: serialize(doc) }, { status: 201 })
  } catch (error) {
    return toJson(error)
  }
}
