import { getSessionUser } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { deleteDbAccount } from "@/lib/mail/accounts";
import { NextRequest } from "next/server";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;

  try {
    await deleteDbAccount(id);
    return Response.json({ id, status: "deleted" });
  } catch (err) {
    return ApiError.internal("DB_ERROR", err instanceof Error ? err.message : "Failed to remove account").toResponse();
  }
}
