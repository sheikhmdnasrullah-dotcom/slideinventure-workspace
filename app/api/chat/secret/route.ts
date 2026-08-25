import { getSessionUser } from "@/lib/appwrite/auth"
import { databases } from "@/lib/appwrite/server"
import { Query } from "node-appwrite"
import { APPWRITE } from "@/lib/appwrite/config"
import { ApiError } from "@/lib/api/errors"
import { checkRateLimit } from "@/lib/api/rate-limit"
import { NextRequest } from "next/server"

const DB = APPWRITE.databaseId
const COL = APPWRITE.collections.vault

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return ApiError.unauthorized().toResponse()

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 })
  if (!limit.allowed) return ApiError.rateLimited().toResponse()

  try {
    const body = await request.json().catch(() => ({}))
    const secretName = (body.secretName as string | undefined)?.trim()
    if (!secretName) {
      return Response.json({ error: "Secret name required" }, { status: 400 })
    }

    const res = await databases.listDocuments(DB, COL, [
      Query.equal("name", secretName),
      Query.equal("created_by", user.email ?? ""),
      Query.limit(1),
    ])

    const entry = res.documents[0]
    if (!entry) {
      return Response.json(
        { error: "Secret not found or access denied" },
        { status: 404 }
      )
    }

    // Decrypt the secret
    const { decryptSecret } = await import("@/lib/vault/crypto")
    const encrypted = (entry as any).encrypted_value
    const decrypted = decryptSecret(encrypted)

    return Response.json({
      name: (entry as any).name,
      secretType: (entry as any).secret_type,
      value: decrypted,
      serviceName: (entry as any).service_name,
      username: (entry as any).username,
      url: (entry as any).url,
      notes: (entry as any).notes,
    })
  } catch (error) {
    console.error("Secret retrieval error:", error)
    return Response.json(
      { error: "Failed to retrieve secret" },
      { status: 500 }
    )
  }
}
