import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/appwrite/auth";
import { saveProspects } from "@/lib/youtube-email/storage";
import { crawlEmails } from "@/lib/leads/email-crawler";

// Kept as a thin, backward-compatible wrapper (Agent Canvas "youtube" nodes and
// any external caller still hit this route) over the same unified multi-agent
// email crawler used by /api/email-crawler. It no longer hard-requires the
// Temporal gateway: crawlEmails() tries the gateway first when configured and
// automatically hands off to the local browse agent otherwise.
const CONCURRENCY = 3;

async function runBatched<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

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

  try {
    const results = await runBatched(clean, CONCURRENCY, async (channel) => {
      const outcome = await crawlEmails({ link: channel, userEmail: user.email });
      const emails = outcome.emails.map((e) => e.email);
      const winner = outcome.trail.find((t) => t.status === "success")?.label ?? null;
      return {
        channel,
        email: emails[0] ?? null,
        emails,
        websites: [] as string[],
        method: winner,
        error: emails.length ? null : (outcome.error ?? null),
      };
    });

    // Instantly save extracted prospects to persistent storage and knowledge base
    const validToSave = results.filter((r) => !r.error && ((r.emails && r.emails.length > 0) || r.email));
    if (validToSave.length > 0) {
      await saveProspects(validToSave).catch((e) => console.warn("Failed to auto-save prospects:", e));
    }

    return Response.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "youtube-email failed";
    return Response.json({ results: [], error: message }, { status: 502 });
  }
}
