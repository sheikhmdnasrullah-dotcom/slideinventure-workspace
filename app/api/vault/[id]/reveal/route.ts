import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { decryptSecret } from "@/lib/vault/crypto";
import { recordAudit } from "@/lib/api/audit";
import { getClientIp, getUserAgent } from "@/lib/api/request";
import { NextRequest } from "next/server";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.vault;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const reauthCookie = _request.cookies.get("vault_reauth")?.value;
  if (reauthCookie !== "1") {
    return ApiError.badRequest("REAUTH_REQUIRED", "Re-authentication required").toResponse();
  }

  const limit = checkRateLimit(_request, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!limit.allowed)
    return ApiError.rateLimited("RATE_LIMITED", "Too many reveal requests", Math.ceil(limit.resetAt / 1000)).toResponse();

  const { id } = await params;
  const res = await databases.listDocuments(DB, COL, [
    Query.equal("$id", id),
    Query.equal("created_by", user.email ?? ""),
  ]);
  const data = res.documents[0];
  if (!data) return ApiError.notFound("VAULT_ENTRY_NOT_FOUND", "Vault entry not found").toResponse();

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return ApiError.notFound("VAULT_ENTRY_EXPIRED", "Vault entry has expired").toResponse();
  }

  try {
    const decrypted = decryptSecret(data.encrypted_value);

    await recordAudit({
      table: "secret_vault_entries",
      recordId: id,
      action: "read",
      metadata: {
        secretName: data.name,
        keyVersion: data.key_version,
        action: "reveal",
      },
      actor: {
        userEmail: user.email ?? undefined,
        userId: user.id,
        ip: getClientIp(_request),
        userAgent: getUserAgent(_request),
      },
    });

    return Response.json({ secret: decrypted });
  } catch {
    return ApiError.internal("DECRYPTION_ERROR", "Failed to decrypt secret").toResponse();
  }
}
