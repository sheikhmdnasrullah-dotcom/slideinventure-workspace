import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError, toJson } from "@/lib/api/errors";
import { captureResearchInsight, ResearchLabSource } from "@/lib/brain/capture";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user?.email) return ApiError.unauthorized().toResponse();

  try {
    const body = await request.json();
    const { source, sourceRef, title, rawText, reference, force } = body;

    if (!source || !sourceRef || typeof rawText !== "string") {
      return ApiError.badRequest("MISSING_FIELDS", "source, sourceRef, and rawText are required").toResponse();
    }

    const item = await captureResearchInsight({
      userEmail: user.email,
      source: source as ResearchLabSource,
      sourceRef,
      title: title || "Untitled",
      rawText,
      reference,
      force: Boolean(force),
    });

    return Response.json({ ok: true, item });
  } catch (error) {
    return toJson(error);
  }
}
