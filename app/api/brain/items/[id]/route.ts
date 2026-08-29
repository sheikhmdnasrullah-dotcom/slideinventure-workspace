import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { deleteResearchLabItem } from "@/lib/brain/capture";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, {
    limit: 30,
    windowMs: 60_000,
    identifier: `research-lab-delete:${user.id}`,
  });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const { id } = await params;
  try {
    const ok = await deleteResearchLabItem(user.email ?? "", id);
    if (!ok) return ApiError.notFound().toResponse();
    return Response.json({ ok: true });
  } catch (error) {
    return toJson(error);
  }
}
