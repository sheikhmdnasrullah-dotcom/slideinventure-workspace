import "server-only";
import { verifyEmail } from "@/lib/verify/reacher";
import fs from "node:fs";
import path from "node:path";

const CSV_PATH = path.resolve(process.cwd(), "efa.csv");
const SIDECAR = path.resolve(process.cwd(), "efa-results.json");

const GATEWAY = (process.env.TEMPORAL_GATEWAY_URL || "").replace(/\/$/, "");
const GATEWAY_KEY = process.env.TEMPORAL_GATEWAY_KEY || "";
const THEH = (process.env.THEHARVESTER_API_URL || "").replace(/\/$/, "");
const THEH_KEY = process.env.THEHARVESTER_API_KEY || "";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SKIP_HOSTS = new Set([
  "linkedin.com", "twitter.com", "x.com", "facebook.com", "instagram.com",
  "youtube.com", "youtu.be", "tiktok.com", "google.com", "linktr.ee", "tr.ee",
  "beacons.ai", "bio.site", "linkbio.site", "snipfeed.co", "stan.store",
  "apple.com", "podcasts.apple.com", "spotify.com", "pinterest.com", "reddit.com",
  "medium.com", "substack.com", "threads.net", "vimeo.com", "rumble.com",
  "odysee.com", "bitchute.com", "github.com", "cash.app", "venmo.com", "paypal.com",
]);
const PREFIXES = ["info", "contact", "hello", "support", "press", "media", "business", "team", "admin", "sales"];

type Cand = { email: string; source: string };

function extractDomain(link: string): string | null {
  if (!link) return null;
  try {
    const u = new URL(link.startsWith("http") ? link : `https://${link}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (SKIP_HOSTS.has(host)) return null;
    return host;
  } catch {
    return null;
  }
}

async function gatewayYoutubeEmail(channel: string): Promise<{ email: string | null; emails: string[]; websites: string[] }> {
  if (!GATEWAY || !GATEWAY_KEY) return { email: null, emails: [], websites: [] };
  try {
    const res = await fetch(`${GATEWAY}/youtube-email`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-temporal-gateway-key": GATEWAY_KEY },
      body: JSON.stringify({ channel }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return { email: null, emails: [], websites: [] };
    const d = (await res.json().catch(() => ({}))) as any;
    const emails: string[] = Array.isArray(d.emails) ? d.emails.map((e: string) => String(e).toLowerCase()) : [];
    if (d.email && typeof d.email === "string") emails.push(d.email.toLowerCase());
    return { email: d.email ?? null, emails: [...new Set(emails)], websites: Array.isArray(d.websites) ? d.websites : [] };
  } catch {
    return { email: null, emails: [], websites: [] };
  }
}

async function theHarvester(domain: string): Promise<string[]> {
  if (!THEH || !THEH_KEY) return [];
  try {
    const submit = await fetch(`${THEH}/api/v1/runs`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": THEH_KEY },
      body: JSON.stringify({ target: domain, sources: ["emails"], limit: 500, deadline_seconds: 40 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!submit.ok) return [];
    const submitted = (await submit.json().catch(() => null)) as { run_id?: string } | null;
    if (!submitted?.run_id) return [];
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2500));
      const poll = await fetch(`${THEH}/api/v1/runs/${submitted.run_id}`, {
        headers: { "x-api-key": THEH_KEY },
        signal: AbortSignal.timeout(10000),
      }).catch(() => null);
      if (!poll || !poll.ok) continue;
      const data = (await poll.json().catch(() => null)) as any;
      if (!data) continue;
      if (["completed", "failed", "cancelled"].includes(data.status)) {
        const results = Array.isArray(data.results) ? data.results : [];
        const typed = results
          .map((r: any) => r?.value || "")
          .filter((v: string) => EMAIL_RE.test(v));
        const swept = (JSON.stringify(data).match(EMAIL_RE) || []).map((e) => e.toLowerCase());
        return [...new Set([...typed, ...swept].map((e: string) => e.toLowerCase()))];
      }
    }
    return [];
  } catch {
    return [];
  }
}

async function patternGuess(domain: string): Promise<Cand[]> {
  const out: Cand[] = [];
  for (const p of PREFIXES) {
    const email = `${p}@${domain}`;
    const v = await verifyEmail(email).catch(() => ({ status: "error" as const }));
    if (v.status === "valid") out.push({ email, source: `pattern-verified (${domain})` });
  }
  return out;
}

function pickBest(cands: Cand[]): { email: string | null; source: string | null } {
  if (!cands.length) return { email: null, source: null };
  // Prefer pattern-verified (Reacher SMTP confirmed deliverable); else first real-source hit.
  const verified = cands.find((c) => c.source.startsWith("pattern-verified"));
  if (verified) return { email: verified.email, source: verified.source };
  return { email: cands[0].email, source: cands[0].source };
}

async function processChannel(channel: string, name: string): Promise<{ email: string | null; source: string | null; all: Cand[] }> {
  const cands: Cand[] = [];

  // Agent 1 (Temporal gateway) — direct email + websites
  const gw = await gatewayYoutubeEmail(channel);
  for (const e of gw.emails) cands.push({ email: e, source: "gateway-website" });

  const domains = [...new Set(gw.websites.map(extractDomain).filter(Boolean) as string[])];
  if (!domains.length) {
    const d = extractDomain(channel);
    if (d) domains.push(d);
  }
  const limited = domains.slice(0, 3);

  // Agent 5 (theHarvester) on each real domain
  for (const d of limited) {
    const found = await theHarvester(d);
    for (const e of found) cands.push({ email: e.toLowerCase(), source: `osint-harvester (${d})` });
  }

  // Agent 4 (Pattern Verifier + Reacher SMTP)
  for (const d of limited) {
    const guessed = await patternGuess(d);
    cands.push(...guessed);
  }

  const uniq = [...new Map(cands.map((c) => [c.email, c])).values()];
  const { email, source } = pickBest(uniq);
  return { email, source, all: uniq };
}

// ---- CSV plumbing ----
type Row = [string, string, string, string, string];
function readCsv(p: string): { header: string; rows: Row[] } {
  const raw = fs.readFileSync(p, "utf8").trimEnd();
  const lines = raw.split("\n");
  const header = lines[0];
  const rows: Row[] = lines.slice(1).map((l) => {
    const parts = l.split(",");
    while (parts.length < 5) parts.push("");
    return [parts[0] || "", parts[1] || "", parts[2] || "", parts[3] || "", parts[4] || ""];
  });
  return { header, rows };
}
function writeCsv(p: string, header: string, rows: Row[]) {
  const out = [header, ...rows.map((r) => r.join(","))].join("\n") + "\n";
  fs.writeFileSync(p, out);
}

async function main() {
  const LIMIT = Number(process.env.LIMIT || 0);
  const { header, rows } = readCsv(CSV_PATH);
  const sidecar: Record<string, any> = fs.existsSync(SIDECAR) ? JSON.parse(fs.readFileSync(SIDECAR, "utf8")) : {};
  const queue: Row[] = [];
  for (const r of rows) {
    const channel = (r[4] || "").trim();
    const key = channel || r[0];
    if (!channel) continue;
    if (r[2] && r[2].includes("@")) continue; // already has an email
    if (sidecar[key]?.done) continue; // already processed (resolved or empty)
    queue.push(r);
    if (LIMIT && queue.length >= LIMIT) break;
  }
  console.log(`Queued ${queue.length} channels to process.`);

  const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
  let idx = 0;
  let done = 0;
  const errors: string[] = [];

  async function worker() {
    while (idx < queue.length) {
      const i = idx++;
      const r = queue[i];
      const channel = r[4].trim();
      const key = channel || r[0];
      const name = [r[0], r[1]].filter(Boolean).join(" ").trim() || channel;
      try {
        const res = await processChannel(channel, name);
        if (res.email) r[2] = res.email;
        sidecar[key] = {
          done: true,
          email: res.email,
          source: res.source,
          candidates: res.all,
          name,
        };
        console.log(`[${done + 1}/${queue.length}] ${name} -> ${res.email || "(none)"} (${res.source || ""})`);
      } catch (e: any) {
        sidecar[key] = { done: false, error: e?.message || "failed" };
        errors.push(`${name}: ${e?.message || "failed"}`);
        console.log(`[${done + 1}/${queue.length}] ${name} -> ERROR ${e?.message || ""}`);
      }
      done++;
      writeCsv(CSV_PATH, header, rows);
      fs.writeFileSync(SIDECAR, JSON.stringify(sidecar, null, 2));
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()));
  const filled = Object.values(sidecar).filter((v: any) => v.email).length;
  console.log(`\nDONE. Resolved ${filled} emails. Errors: ${errors.length}`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
