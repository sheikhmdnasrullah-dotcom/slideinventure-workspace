import "server-only";

// Self-hosted Reacher email verification (https://reacher.email). The app calls
// the same HTTPS endpoint the VPS script uses, with the shared x-reacher-secret
// header. The secret lives ONLY in server env (REACHER_SECRET) — it is never
// sent to the browser. Network/parse failures degrade to "unknown" so callers
// can still import leads; we never throw on a single unreachable address.
const REACHER_BASE = (
  process.env.REACHER_URL || "https://mailtest.nasrullahtanim.me"
).replace(/\/$/, "");
const REACHER_SECRET = process.env.REACHER_SECRET || "";

export type ReacherResult = {
  email: string;
  status: "valid" | "invalid" | "unknown" | "error";
  detail?: string;
};

export function reacherConfigured(): boolean {
  return Boolean(REACHER_SECRET);
}

/** Reacher's `is_reachable` maps straight onto our safe/risky/invalid/unknown UX. */
function classify(reacher: any): "valid" | "invalid" | "unknown" | "error" {
  const reach = String(reacher?.is_reachable ?? "").toLowerCase();
  if (reach === "safe" || reach === "valid") return "valid";
  if (reach === "risky") return "valid"; // deliverable but imperfect MX — keep as a usable lead
  if (reach === "invalid") return "invalid";
  return "unknown";
}

export async function verifyEmail(email: string): Promise<ReacherResult> {
  if (!REACHER_SECRET) {
    return { email, status: "unknown", detail: "Reacher secret not configured" };
  }
  try {
    const res = await fetch(`${REACHER_BASE}/v0/check_email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-reacher-secret": REACHER_SECRET,
      },
      body: JSON.stringify({ to_email: email }),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      // 401/403 mean the secret is wrong; surface it instead of retrying blindly.
      return { email, status: "error", detail: `HTTP ${res.status}` };
    }
    const data = (await res.json().catch(() => null)) as any;
    if (!data) return { email, status: "unknown" };
    return { email, status: classify(data), detail: data.is_reachable };
  } catch (e) {
    return {
      email,
      status: "error",
      detail: e instanceof Error ? e.message : "reacher unreachable",
    };
  }
}

export async function verifyEmails(emails: string[]): Promise<ReacherResult[]> {
  return Promise.all(emails.map((e) => verifyEmail(e)));
}
