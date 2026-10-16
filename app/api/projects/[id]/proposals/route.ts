import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import type { Proposal } from "@/lib/project-workspace/types";
import { getProjectStore, requireProjectUser, workspaceErrorToResponse } from "../../_shared";

type Params = { params: Promise<{ id: string }> };

/** GET → list proposals (?status=pending). POST → create (user-authored). */
export async function GET(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 60, windowMs: 60_000, identifier: `pw-proposals-list:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id } = await params;
    const status = request.nextUrl.searchParams.get("status") as Proposal["status"] | null;
    const proposals = getProjectStore().listProposals(
      user.id,
      id,
      status ?? undefined
    );
    return Response.json({ proposals });
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await requireProjectUser();
  if (user instanceof Response) return user;

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000, identifier: `pw-proposals-create:${user.id}` });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      op?: unknown;
      path?: unknown;
      summary?: unknown;
      content?: unknown;
    };
    if (body.op !== "create" && body.op !== "edit") {
      return ApiError.badRequest("OP_REQUIRED", "op must be 'create' or 'edit'").toResponse();
    }
    if (typeof body.path !== "string" || typeof body.summary !== "string" || typeof body.content !== "string") {
      return ApiError.badRequest("FIELDS_REQUIRED", "path, summary, and content are required").toResponse();
    }
    const proposal = getProjectStore().createProposal(user.id, id, {
      op: body.op,
      path: body.path,
      summary: body.summary,
      content: body.content,
      createdBy: "user",
    });
    return Response.json({ proposal }, { status: 201 });
  } catch (error) {
    return workspaceErrorToResponse(error);
  }
}
