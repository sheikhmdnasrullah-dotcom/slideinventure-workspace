import "server-only";

/**
 * Send gate (ADR 2026-10-16, D1/F3): slidein-api is the single send
 * authority. Real outbound sends from this app are allowed only when
 * SLIDEIN_API_URL and SLIDEIN_API_KEY are configured AND the slidein-api
 * health check succeeds. Otherwise every real-send call site fails closed.
 */

const HEALTH_CACHE_TTL_MS = 30_000;
const HEALTH_TIMEOUT_MS = 5_000;

export type SendGateStatus = {
  enabled: boolean;
  reason: string | null;
  checkedAt: string;
};

export class SendGateError extends Error {
  public readonly reason: string;
  constructor(reason: string) {
    super(`Outbound sending is disabled: ${reason}`);
    this.name = "SendGateError";
    this.reason = reason;
  }
}

function getConfig(): { apiUrl: string; apiKey: string } | null {
  const apiUrl = process.env.SLIDEIN_API_URL?.trim();
  const apiKey = process.env.SLIDEIN_API_KEY?.trim();
  if (!apiUrl || !apiKey) return null;
  return { apiUrl: apiUrl.replace(/\/+$/, ""), apiKey };
}

let cache: { status: SendGateStatus; expiresAt: number } | null = null;

export async function getSendGateStatus(): Promise<SendGateStatus> {
  if (cache && cache.expiresAt > Date.now()) return cache.status;

  const config = getConfig();
  let status: SendGateStatus;
  if (!config) {
    status = {
      enabled: false,
      reason:
        "slidein-api is not configured on the server (set SLIDEIN_API_URL and SLIDEIN_API_KEY).",
      checkedAt: new Date().toISOString(),
    };
  } else {
    let healthy = false;
    try {
      const res = await fetch(`${config.apiUrl}/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      healthy = res.ok;
    } catch {
      healthy = false;
    }
    status = healthy
      ? { enabled: true, reason: null, checkedAt: new Date().toISOString() }
      : {
          enabled: false,
          reason: `slidein-api at ${config.apiUrl} did not pass its health check.`,
          checkedAt: new Date().toISOString(),
        };
  }

  cache = { status, expiresAt: Date.now() + HEALTH_CACHE_TTL_MS };
  return status;
}

export async function assertSendAllowed(): Promise<SendGateStatus> {
  const status = await getSendGateStatus();
  if (!status.enabled) throw new SendGateError(status.reason ?? "send gate is closed");
  return status;
}

type SlideinApiSendInput = {
  tenantId: string;
  draftId: string;
  senderEmail?: string;
  transport?: Record<string, unknown>;
};

/** Thin client for slidein-api's authorized draft-dispatch endpoint
 * (POST /tenants/{tenant_id}/drafts/{draft_id}/send, Bearer API key). */
export async function sendDraftViaSlideinApi(
  input: SlideinApiSendInput
): Promise<Record<string, unknown>> {
  await assertSendAllowed();
  const config = getConfig();
  if (!config) throw new SendGateError("slidein-api is not configured on the server");

  let res: Response;
  try {
    res = await fetch(
      `${config.apiUrl}/tenants/${encodeURIComponent(input.tenantId)}/drafts/${encodeURIComponent(input.draftId)}/send`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          approved: true,
          ...(input.senderEmail ? { sender_email: input.senderEmail } : {}),
          ...(input.transport ? { transport: input.transport } : {}),
        }),
      }
    );
  } catch {
    throw new Error("Network error contacting slidein-api send endpoint");
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "detail" in data
        ? typeof (data as { detail: unknown }).detail === "string"
          ? (data as { detail: string }).detail
          : JSON.stringify((data as { detail: unknown }).detail)
        : `slidein-api send failed with status ${res.status}`;
    throw new Error(message);
  }
  return (data ?? {}) as Record<string, unknown>;
}
