import { createServiceClient, getSessionUser } from "@/lib/supabase/server"
import { ApiError } from "@/lib/api/errors"
import { checkRateLimit } from "@/lib/api/rate-limit"
import { NextRequest } from "next/server"

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

    const supabase = createServiceClient()

    // Check if the user has permission to access vault
    const { data: entry, error } = await supabase
      .from("secret_vault_entries")
      .select("id, name, encrypted_value, iv, key_version, secret_type, service_name, username, url, notes")
      .eq("name", secretName)
      .eq("created_by", user.email ?? "")
      .single()

    if (error || !entry) {
      return Response.json(
        { error: "Secret not found or access denied" },
        { status: 404 }
      )
    }

    // Decrypt the secret
    const { decryptSecret } = await import("@/lib/vault/crypto")
    const { encrypted_value: encrypted } = entry
    const decrypted = decryptSecret(encrypted)

    return Response.json({
      name: entry.name,
      secretType: entry.secret_type,
      value: decrypted,
      serviceName: entry.service_name,
      username: entry.username,
      url: entry.url,
      notes: entry.notes,
    })
  } catch (error) {
    console.error("Secret retrieval error:", error)
    return Response.json(
      { error: "Failed to retrieve secret" },
      { status: 500 }
    )
  }
}