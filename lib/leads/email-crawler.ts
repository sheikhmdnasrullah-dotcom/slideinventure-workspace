import "server-only";
import { runBrowseTask } from "@/lib/browse/agent";
import { databases, ID, Query } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { verifyEmail, reacherConfigured } from "@/lib/verify/reacher";
import { enrichWithPythonService } from "@/lib/email-crawler/service";
import { logActivity } from "@/lib/activities/client";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const YOUTUBE_RE = /(youtube\.com|youtu\.be)/i;
const GUESS_PREFIXES = ["info", "contact", "hello", "support", "press", "media", "business", "team"];
const SOCIAL_HOSTS = new Set([
  "linkedin.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "google.com",
]);

export type CrawledEmail = {
  email: string;
  source: string;
  verdict: "valid" | "invalid" | "unknown" | "error";
  leadId?: string | null;
};

export type CrawlAgentId =
  | "youtube-extractor"
  | "deep-crawler"
  | "browse-agent"
  | "pattern-verifier"
  | "osint-harvester";

/**
 * One entry per agent in the handoff chain. "empty"/"error" both mean the next
 * agent took over — the pipeline only stops on "success" or after every agent
 * has had a turn.
 */
export type CrawlStep = {
  agent: CrawlAgentId;
  label: string;
  status: "success" | "empty" | "error" | "skipped";
  detail?: string;
};

export type EmailCrawlerResult = {
  ok: boolean;
  emails: CrawledEmail[];
  imported: number;
  raw: string;
  trail: CrawlStep[];
  error?: string;
};

type Candidate = { email: string; source: string };

function extractCandidates(text: string): Candidate[] {
  const found = [...new Set((text.match(EMAIL_RE) || []).map((e) => e.toLowerCase()))];
  const lines = text.split("\n");
  return found.map((email) => {
    const line = lines.find((l) => l.includes(email)) || "";
    const source = line
      .replace(email, "")
      .replace(/[—–-]/g, " ")
      .replace(/[^\w\s.@:/]/g, "")
      .trim()
      .slice(0, 120);
    return { email, source: source || "web" };
  });
}

function extractDomain(link: string): string | null {
  if (!link) return null;
  try {
    const u = new URL(link.startsWith("http") ? link : `https://${link}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (SOCIAL_HOSTS.has(host)) return null;
    return host;
  } catch {
    return null;
  }
}

function coerceResultText(result: unknown): string {
  return typeof result === "string" ? result : JSON.stringify(result ?? "");
}

/**
 * Real-world YouTube links almost always carry a `?si=...` share-tracking
 * param (and sometimes a trailing /videos, /featured, etc.). Naive string
 * concatenation of "/about" onto those produces a malformed URL like
 * "...?si=xyz/about". Parse properly and rebuild instead.
 */
function buildYoutubeAboutUrl(link: string): string {
  try {
    const u = new URL(link);
    let pathname = u.pathname.replace(/\/(about|videos|featured|streams|shorts|community|playlists)\/?$/i, "");
    if (!pathname.endsWith("/")) pathname += "/";
    return `${u.origin}${pathname}about`;
  } catch {
    return link.split(/[?#]/)[0].replace(/\/(about|videos|featured)\/?$/i, "") + "/about";
  }
}

/**
 * Agent 1 — YouTube Extractor. Only engages for YouTube links. Prefers the
 * Temporal gateway when configured (dedicated worker, better CAPTCHA
 * throughput); if that isn't configured or fails, hands off to the same local
 * browse agent used everywhere else in the app, aimed at the channel's About
 * page. Returns null on a hard failure (so the caller can hand off), or an
 * array (possibly empty) on a completed attempt.
 */
async function runYoutubeExtractor(link: string, userEmail: string): Promise<Candidate[] | null> {
  const gateway = process.env.TEMPORAL_GATEWAY_URL;
  const key = process.env.TEMPORAL_GATEWAY_KEY;
  if (gateway && key) {
    try {
      const res = await fetch(`${gateway.replace(/\/$/, "")}/youtube-email`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-temporal-gateway-key": key },
        body: JSON.stringify({ channel: link }),
        signal: AbortSignal.timeout(45000),
      });
      const data = await res.json().catch(() => ({}) as Record<string, unknown>);
      const emails: string[] = Array.isArray(data.emails)
        ? (data.emails as string[])
        : data.email
          ? [data.email as string]
          : [];
      if (emails.length) {
        return emails.map((e: string) => ({ email: e.toLowerCase(), source: "youtube-about (temporal)" }));
      }
      // Gateway responded but found nothing conclusive — fall through to the
      // local browse fallback below rather than declaring defeat.
    } catch {
      // Gateway unreachable — hand off to the local fallback below.
    }
  }

  const aboutUrl = buildYoutubeAboutUrl(link);
  const task = [
    "You are the YouTube Email Extractor agent. Find the creator's business inquiry email.",
    `Channel: ${link}`,
    "1. Open the channel's About page.",
    '2. Look for a "View email address" button and click it (use a :has-text() selector). If a CAPTCHA appears, solve it and continue.',
    "3. Read the revealed email and any listed business links/websites.",
    "4. Return the email exactly as shown, plus any website links, formatted as: email: source.",
    'If no email is revealed after checking, say "No email found".',
  ].join("\n");

  const res = await runBrowseTask({ task, startUrl: aboutUrl, userEmail, maxSteps: 10 });
  if (!res.ok) return null;
  const observed = res.pagesText?.length ? res.pagesText.join("\n") : coerceResultText(res.result);
  return extractCandidates(observed);
}

/**
 * Agent 2 — Deep Crawler. Wraps the crawl4ai microservice. Emails are pulled
 * with a regex over markdown fetched directly from the page, not guessed by an
 * LLM, so a hit here is treated as trustworthy on its own.
 */
async function runDeepCrawler(link: string, details: string): Promise<{ candidates: Candidate[]; links: string[] } | null> {
  const pre = await enrichWithPythonService(link, details).catch(() => null);
  if (!pre) return null;
  const candidates = (pre.emails || []).map((e) => ({ email: e.toLowerCase(), source: "deep-crawl (crawl4ai)" }));
  return { candidates, links: pre.links?.slice(0, 12) ?? [] };
}

/**
 * Agent 3 — Browse Agent. General LLM-directed browsing (search engines,
 * company/about/press pages). Uses the same fallback chain as the rest of the
 * app (Stagehand -> browser-use -> Playwright, with Steel + 2Captcha for
 * blocks) via runBrowseTask.
 */
async function runBrowseAgent(opts: {
  link: string;
  details: string;
  instructions: string;
  userEmail: string;
  preEmails: string[];
  preLinks: string[];
}): Promise<Candidate[] | null> {
  const { link, details, instructions, userEmail, preEmails, preLinks } = opts;
  const task = [
    "You are an email-finding agent. Find the email address(es) for the prospect described below.",
    "",
    "PROSPECT DETAILS:",
    details || "(none provided)",
    "",
    instructions ? `EXTRA INSTRUCTIONS:\n${instructions}\n` : "",
    "PROCEDURE (start immediately: do not ask for anything, there are no prerequisites):",
    "1. If a starting link is given, OPEN IT FIRST and inspect it fully (footer, About, Team, Press, Contact pages).",
    '2. Run a web search: goto https://www.google.com/search?q=<prospect name and company>+"email" and open several result links (official site, press, podcast, or contact pages).',
    '3. On each visited page, look for mailto: links, "For business inquiries", "Contact", and visible email text.',
    "4. If you hit a CAPTCHA, solve it using the available solver and continue. Never stop because of a CAPTCHA.",
    "5. Keep exploring until you have checked at least 3 sources, or you are confident no public email exists.",
    "6. Return a concise bulleted list, one item per line, formatted exactly as: email: source/context. If you found none, return \"No email found\".",
    "Only include email addresses that literally appear on a page you visited. Do not invent emails.",
    preEmails.length
      ? `\nPRE-DISCOVERED CANDIDATE EMAILS (verify they belong to the prospect):\n${preEmails.join(", ")}`
      : "",
    preLinks.length ? `\nSUGGESTED PAGES TO INSPECT:\n${preLinks.join("\n")}` : "",
  ].join("\n");

  const startUrl = link || `https://www.google.com/search?q=${encodeURIComponent((details || "prospect") + " email contact")}`;
  const res = await runBrowseTask({ task, startUrl, userEmail, maxSteps: 16 });
  if (!res.ok) return null;
  const observed = res.pagesText?.length ? res.pagesText.join("\n") : coerceResultText(res.result);
  return extractCandidates(observed);
}

/**
 * Agent 4 — Pattern Verifier. Last resort: guesses common mailbox prefixes at
 * the prospect's own domain (never a social platform) and only accepts a
 * guess once Reacher's SMTP check confirms it is actually deliverable.
 */
async function runPatternVerifier(domain: string | null): Promise<Candidate[] | null> {
  if (!domain || !reacherConfigured()) return null;
  for (const prefix of GUESS_PREFIXES) {
    const email = `${prefix}@${domain}`;
    const result = await verifyEmail(email).catch(() => ({ status: "error" as const, email, detail: undefined }));
    if (result.status === "valid") {
      return [{ email, source: `pattern-guess (verified via Reacher @ ${domain})` }];
    }
  }
  return [];
}

/**
 * Agent 5 — OSINT Harvester. The true last resort, run only once agents 1-4
 * have all failed or come up empty. Wraps theHarvester
 * (github.com/laramies/theHarvester — GPL-2.0, free, self-hosted via its own
 * Docker Compose) which aggregates dozens of independent public sources for a
 * domain in one pass — certificate-transparency logs (crt.sh), DuckDuckGo/Bing,
 * GitHub code search, HaveIBeenPwned, and more. It is a fundamentally different
 * vantage point than "browse this specific page", so it turns up emails the
 * first four agents structurally cannot see (e.g. one that only ever leaked
 * into a cert log or a public breach, never published on any page).
 *
 * Requires THEHARVESTER_API_URL + THEHARVESTER_API_KEY (its REST API, see
 * docs/wiki/Rest-API.md in that repo). Not configured -> skipped, not a
 * failure.
 */
async function runOsintHarvester(domain: string | null): Promise<Candidate[] | null> {
  const base = process.env.THEHARVESTER_API_URL;
  const key = process.env.THEHARVESTER_API_KEY;
  if (!domain || !base || !key) return null;

  const root = base.replace(/\/$/, "");
  try {
    const submit = await fetch(`${root}/api/v1/runs`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify({ target: domain, sources: ["emails"], limit: 500, deadline_seconds: 45 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!submit.ok) return null;
    const submitted = (await submit.json().catch(() => null)) as { run_id?: string } | null;
    if (!submitted?.run_id) return null;

    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const poll = await fetch(`${root}/api/v1/runs/${submitted.run_id}`, {
        headers: { "x-api-key": key },
        signal: AbortSignal.timeout(10000),
      }).catch(() => null);
      if (!poll || !poll.ok) continue;
      const data = (await poll.json().catch(() => null)) as { status?: string; results?: unknown[] } | null;
      if (!data) continue;
      if (data.status === "completed" || data.status === "failed" || data.status === "cancelled") {
        const results = Array.isArray(data.results) ? data.results : [];
        const typed = results
          .map((r) => r as { type?: string; kind?: string; value?: string })
          .filter((r) => r.type === "email" || r.kind === "email")
          .map((r) => (r.value || "").toLowerCase())
          .filter(Boolean);
        // Belt-and-suspenders: the API is versioned and documented, but a regex
        // sweep over the raw payload guards against a field-name drift meaning
        // we'd otherwise silently miss a real result.
        const swept = (JSON.stringify(data).match(EMAIL_RE) || []).map((e) => e.toLowerCase());
        const emails = [...new Set([...typed, ...swept])];
        return emails.map((email) => ({ email, source: `osint-harvester (${domain})` }));
      }
    }
    return []; // timed out without a terminal run state — treat as empty, not an error
  } catch {
    return null;
  }
}

/**
 * Email Crawler: a five-agent handoff pipeline. Given a prospect link and/or
 * free-form details, each agent gets a turn — YouTube Extractor, Deep Crawler,
 * Browse Agent, Pattern Verifier, then OSINT Harvester — and a failed or empty
 * attempt hands off to the next one automatically. The pipeline only reports
 * "no email found" after every agent has been tried; it never stops on a
 * single agent's failure.
 */
export async function crawlEmails(opts: {
  link?: string;
  details?: string;
  instructions?: string;
  userEmail: string;
}): Promise<EmailCrawlerResult> {
  const link = (opts.link || "").trim();
  const details = (opts.details || "").trim();
  const instructions = (opts.instructions || "").trim();
  const trail: CrawlStep[] = [];
  let candidates: Candidate[] = [];
  let raw = "";

  // Agent 1: YouTube Extractor
  if (YOUTUBE_RE.test(link)) {
    try {
      const result = await runYoutubeExtractor(link, opts.userEmail);
      if (result === null) {
        trail.push({ agent: "youtube-extractor", label: "YouTube Extractor", status: "error", detail: "unreachable — handed off" });
      } else if (result.length) {
        trail.push({ agent: "youtube-extractor", label: "YouTube Extractor", status: "success" });
        candidates = result;
      } else {
        trail.push({ agent: "youtube-extractor", label: "YouTube Extractor", status: "empty", detail: "no email on About page — handed off" });
      }
    } catch (e) {
      trail.push({ agent: "youtube-extractor", label: "YouTube Extractor", status: "error", detail: e instanceof Error ? e.message : "failed — handed off" });
    }
  } else {
    trail.push({ agent: "youtube-extractor", label: "YouTube Extractor", status: "skipped", detail: "not a YouTube link" });
  }

  // Agent 2: Deep Crawler
  let deepLinks: string[] = [];
  if (!candidates.length) {
    try {
      const deep = await runDeepCrawler(link, details);
      if (deep === null) {
        trail.push({ agent: "deep-crawler", label: "Deep Crawler", status: "skipped", detail: "crawl4ai service not configured" });
      } else if (deep.candidates.length) {
        trail.push({ agent: "deep-crawler", label: "Deep Crawler", status: "success" });
        candidates = deep.candidates;
        deepLinks = deep.links;
      } else {
        trail.push({ agent: "deep-crawler", label: "Deep Crawler", status: "empty", detail: "no email in crawled markdown — handed off" });
        deepLinks = deep.links;
      }
    } catch (e) {
      trail.push({ agent: "deep-crawler", label: "Deep Crawler", status: "error", detail: e instanceof Error ? e.message : "failed — handed off" });
    }
  } else {
    trail.push({ agent: "deep-crawler", label: "Deep Crawler", status: "skipped", detail: "email already found" });
  }

  // Agent 3: Browse Agent
  if (!candidates.length) {
    try {
      const result = await runBrowseAgent({
        link,
        details,
        instructions,
        userEmail: opts.userEmail,
        preEmails: [],
        preLinks: deepLinks,
      });
      if (result === null) {
        trail.push({ agent: "browse-agent", label: "Browse Agent", status: "error", detail: "browser session failed — handed off" });
      } else if (result.length) {
        trail.push({ agent: "browse-agent", label: "Browse Agent", status: "success" });
        candidates = result;
        raw = result.map((c) => `${c.email}: ${c.source}`).join("\n");
      } else {
        trail.push({ agent: "browse-agent", label: "Browse Agent", status: "empty", detail: "no email surfaced across sources — handed off" });
      }
    } catch (e) {
      trail.push({ agent: "browse-agent", label: "Browse Agent", status: "error", detail: e instanceof Error ? e.message : "failed — handed off" });
    }
  } else {
    trail.push({ agent: "browse-agent", label: "Browse Agent", status: "skipped", detail: "email already found" });
  }

  // Domain used by both last-resort agents below (verifier guesses at it,
  // harvester searches public sources about it).
  const domain = extractDomain(link) || deepLinks.map(extractDomain).find(Boolean) || null;

  // Agent 4: Pattern Verifier
  if (!candidates.length) {
    try {
      const result = await runPatternVerifier(domain);
      if (result === null) {
        trail.push({
          agent: "pattern-verifier",
          label: "Pattern Verifier",
          status: "skipped",
          detail: domain ? "Reacher not configured" : "no known domain to guess against",
        });
      } else if (result.length) {
        trail.push({ agent: "pattern-verifier", label: "Pattern Verifier", status: "success" });
        candidates = result;
      } else {
        trail.push({ agent: "pattern-verifier", label: "Pattern Verifier", status: "empty", detail: `no deliverable mailbox found at ${domain}` });
      }
    } catch (e) {
      trail.push({ agent: "pattern-verifier", label: "Pattern Verifier", status: "error", detail: e instanceof Error ? e.message : "failed — handed off" });
    }
  } else {
    trail.push({ agent: "pattern-verifier", label: "Pattern Verifier", status: "skipped", detail: "email already found" });
  }

  // Agent 5: OSINT Harvester (last resort — see runOsintHarvester doc comment)
  if (!candidates.length) {
    try {
      const result = await runOsintHarvester(domain);
      if (result === null) {
        trail.push({
          agent: "osint-harvester",
          label: "OSINT Harvester",
          status: "skipped",
          detail: domain ? "theHarvester not configured" : "no known domain to search",
        });
      } else if (result.length) {
        trail.push({ agent: "osint-harvester", label: "OSINT Harvester", status: "success" });
        candidates = result;
      } else {
        trail.push({
          agent: "osint-harvester",
          label: "OSINT Harvester",
          status: "empty",
          detail: `no email surfaced across public sources for ${domain}`,
        });
      }
    } catch (e) {
      trail.push({ agent: "osint-harvester", label: "OSINT Harvester", status: "error", detail: e instanceof Error ? e.message : "failed" });
    }
  } else {
    trail.push({ agent: "osint-harvester", label: "OSINT Harvester", status: "skipped", detail: "email already found" });
  }

  if (!candidates.length) {
    await logActivity({
      category: "leads",
      action: "imported",
      title: "Email Crawler run — exhausted",
      description: `4 agents tried, no verifiable email for: ${details.slice(0, 60) || link}`,
      entityType: "leads",
      notify: true,
      metadata: { link: link || null, trail },
    }).catch(() => {});
    return {
      ok: true,
      emails: [],
      imported: 0,
      raw:
        raw ||
        "No email found after handing the task through every agent (YouTube Extractor, Deep Crawler, Browse Agent, Pattern Verifier, OSINT Harvester).",
      trail,
    };
  }

  // Verify + import whatever the winning agent produced.
  const out: CrawledEmail[] = [];
  let imported = 0;
  const DB = APPWRITE.databaseId;
  const COL = APPWRITE.collections.leads;
  const now = new Date().toISOString();

  for (const c of candidates) {
    const verdict = (await verifyEmail(c.email).catch(() => ({ status: "unknown" as const }))).status;
    let leadId: string | null = null;

    const existing = await databases
      .listDocuments(DB, COL, [Query.equal("email", c.email), Query.limit(1)])
      .catch(() => ({ documents: [] as unknown[] }));
    if (!existing.documents.length) {
      const doc = await databases
        .createDocument(DB, COL, ID.unique(), {
          first_name: "",
          last_name: "",
          email: c.email,
          company: details.slice(0, 80) || null,
          source: "email-crawler",
          status: "new",
          tags: ["email-crawler"],
          custom_fields: JSON.stringify({ link: link || null, details: details || null, source: c.source }),
          created_at: now,
          updated_at: now,
        })
        .catch(() => null);
      if (doc) {
        leadId = doc.$id;
        imported++;
      }
    }
    out.push({ email: c.email, source: c.source, verdict, leadId });
  }

  if (YOUTUBE_RE.test(link)) {
    const { saveProspects } = await import("@/lib/youtube-email/storage");
    await saveProspects([
      {
        channel: link,
        emails: out.map((o) => o.email),
        method: trail.find((t) => t.status === "success")?.label ?? "Email Crawler",
      },
    ]).catch(() => {});
  }

  const winner = trail.find((t) => t.status === "success")?.label ?? "agent";
  await logActivity({
    category: "leads",
    action: "imported",
    title: "Email Crawler run",
    description: `Crawled ${out.length} candidate email(s) (${imported} imported) for: ${details.slice(0, 60) || link} — found by ${winner}`,
    entityType: "leads",
    notify: true,
    metadata: { link: link || null, imported, candidates: out.length, trail },
  }).catch(() => {});

  return { ok: true, emails: out, imported, raw: raw || out.map((o) => `${o.email}: ${o.source}`).join("\n"), trail };
}
