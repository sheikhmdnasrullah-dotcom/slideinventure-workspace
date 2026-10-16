import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getProjectStore, requireProjectUser, workspaceErrorToResponse } from "../../_shared";

type Params = { params: Promise<{ id: string }> };

/** GET ?q=… → filename + content search across the project. */
export async function GET(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 60, windowMs: 60_000, identifier: `pw-search:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id } = await params;
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const hits = await getProjectStore().search(user.id, id, q);
    return Response.json({ hits });
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}
