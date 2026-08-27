import "server-only";

// TrueMail verification engine. The user runs truemail-rb as an HTTP server on
// the VPS (default port 9292). We call it over the LAN/public IP. Graceful:
// network/parse failures return "unknown" so callers can decide.
const TRUEMAIL_BASE = (process.env.TRUEMAIL_URL || "http://169.58.207.75:9292").replace(/\/$/, "");

export type TruemailResult = {
  email: string;
  status: "valid" | "invalid" | "unknown" | "error";
  detail?: string;
};

export function truemailConfigured(): boolean {
  return Boolean(process.env.TRUEMAIL_URL || true); // defaults to the known VPS IP
}

export async function verifyEmail(email: string): Promise<TruemailResult> {
  try {
    const res = await fetch(`${TRUEMAIL_BASE}/verify_email?email=${encodeURIComponent(email)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { email, status: "error", detail: `HTTP ${res.status}` };
    const data = (await res.json().catch(() => null)) as any;
    if (!data) return { email, status: "unknown" };
    const status = String(data.status ?? data.result ?? "").toLowerCase();
    if (status.includes("valid")) return { email, status: "valid" };
    if (status.includes("invalid")) return { email, status: "invalid" };
    return { email, status: "unknown", detail: JSON.stringify(data).slice(0, 200) };
  } catch (e) {
    return { email, status: "error", detail: e instanceof Error ? e.message : "truemail unreachable" };
  }
}

export async function verifyEmails(emails: string[]): Promise<TruemailResult[]> {
  return Promise.all(emails.map((e) => verifyEmail(e)));
}
