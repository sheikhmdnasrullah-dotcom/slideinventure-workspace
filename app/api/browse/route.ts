import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/appwrite/auth";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const body = await request.json().catch(() => null);
  const query = (body?.query as string) || "";
  const url = (body?.url as string) || "";
  if (!query.trim() && !url.trim()) {
    return ApiError.badRequest("MISSING_QUERY", "query or url is required").toResponse();
  }

  const gateway = process.env.TEMPORAL_GATEWAY_URL;
  const key = process.env.TEMPORAL_GATEWAY_KEY;
  if (!gateway || !key) {
    return Response.json(
      { text: "", error: "Browse gateway not configured" },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${gateway.replace(/\/$/, "")}/browse`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-temporal-gateway-key": key,
      },
      body: JSON.stringify({ query, url }),
    });
    const data = await res.json().catch(() => ({}));
    return Response.json({ text: data.text ?? "", error: data.error ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "browse failed";
    return Response.json({ text: "", error: message }, { status: 502 });
  }
}
