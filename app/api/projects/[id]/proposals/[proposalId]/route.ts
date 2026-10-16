import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getProjectStore, requireProjectUser, workspaceErrorToResponse } from "../../../_shared";

type Params = { params: Promise<{ id: string; proposalId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 60, windowMs: 60_000, identifier: `pw-proposal-get:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id, proposalId } = await params;
    const proposal = getProjectStore().getProposal(user.id, id, proposalId);
    return Response.json({ proposal });
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}

/** POST → decide. Body: { action: "accept" | "reject" }. */
export async function POST(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000, identifier: `pw-proposal-decide:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id, proposalId } = await params;
    const body = (await request.json().catch(() => ({}))) as { action?: unknown };
    const store = getProjectStore();
    if (body.action === "accept") {
      const result = store.acceptProposal(user.id, id, proposalId, user.email);
      return Response.json(result);
    }
    if (body.action === "reject") {
      const proposal = store.rejectProposal(user.id, id, proposalId);
      return Response.json({ proposal });
    }
    return ApiError.badRequest("ACTION_REQUIRED", "action must be 'accept' or 'reject'").toResponse();
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}
