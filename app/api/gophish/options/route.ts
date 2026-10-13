import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { NextRequest } from "next/server";
import { listSendingProfiles, listLandingPages } from "@/lib/gophish";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const [sendingProfiles, landingPages] = await Promise.all([
      listSendingProfiles(),
      listLandingPages(),
    ]);
    // GoPhish returns SMTP credentials in cleartext; the UI only needs names.
    // Never forward password/username to the browser (critical in open mode).
    const safe = (o: { id?: unknown; name?: unknown; from_address?: unknown }) => ({
      id: o.id ?? null,
      name: String(o.name ?? ""),
      from_address: String(o.from_address ?? ""),
    });
    return Response.json({
      sendingProfiles: (sendingProfiles as unknown[]).map((p) =>
        safe(p as { id?: unknown; name?: unknown; from_address?: unknown })
      ),
      landingPages: (landingPages as unknown[]).map((p) =>
        safe(p as { id?: unknown; name?: unknown; from_address?: unknown })
      ),
    });
  } catch (error) {
    return toJson(error);
  }
}
