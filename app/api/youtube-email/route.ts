import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/appwrite/auth";
import { saveProspects } from "@/lib/youtube-email/storage";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const body = await request.json().catch(() => null);
  const channels: string[] = Array.isArray(body?.channels)
    ? body.channels
    : body?.channel
      ? [body.channel]
      : [];
  const clean = channels.map((c) => String(c).trim()).filter(Boolean).slice(0, 25);
  if (!clean.length) {
    return ApiError.badRequest("MISSING_CHANNEL", "channel or channels required").toResponse();
  }

  const gateway = process.env.TEMPORAL_GATEWAY_URL;
  const key = process.env.TEMPORAL_GATEWAY_KEY;
  if (!gateway || !key) {
    return Response.json({ results: [], error: "Browse gateway not configured" }, { status: 503 });
  }

  try {
    const results = await Promise.all(
      clean.map(async (channel) => {
        const res = await fetch(`${gateway.replace(/\/$/, "")}/youtube-email`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-temporal-gateway-key": key,
          },
          body: JSON.stringify({ channel }),
        });
        const data = await res.json().catch(() => ({}));
        return {
          channel,
          email: data.email ?? null,
          emails: Array.isArray(data.emails) ? data.emails : data.email ? [data.email] : [],
          websites: Array.isArray(data.websites) ? data.websites : [],
          method: data.method ?? null,
          error: data.error ?? null,
        };
      }),
    );

    // Instantly save extracted prospects to persistent storage and knowledge base
    const validToSave = results.filter((r) => !r.error && ((r.emails && r.emails.length > 0) || r.email || (r.websites && r.websites.length > 0)));
    if (validToSave.length > 0) {
      await saveProspects(validToSave).catch((e) => console.warn("Failed to auto-save prospects:", e));
    }

    return Response.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "youtube-email failed";
    return Response.json({ results: [], error: message }, { status: 502 });
  }
}
