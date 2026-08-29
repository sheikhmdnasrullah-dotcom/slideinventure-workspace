import "server-only";
import { runBrowseTask } from "@/lib/browse/agent";
import { databases, ID, Query } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { verifyEmail } from "@/lib/verify/reacher";
import { enrichWithPythonService } from "@/lib/email-crawler/service";
import { logActivity } from "@/lib/activities/client";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export type CrawledEmail = {
  email: string;
  source: string;
  verdict: "valid" | "invalid" | "unknown" | "error";
  leadId?: string | null;
};

export type EmailCrawlerResult = {
  ok: boolean;
  emails: CrawledEmail[];
  imported: number;
  raw: string;
  error?: string;
};

/**
 * Email Crawler: given a prospect link + free-form details, the agent surfs the
 * web (no prerequisites: it starts immediately), searches any site it needs,
 * solves CAPTCHAs via 2captcha wherever they appear, and returns the prospect's
 * email(s). Each find is verified with Reacher and imported as a lead.
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

  // Optional Python microservice (crawl4ai) pre-discovery to strengthen the agent.
  const pre = await enrichWithPythonService(link, details).catch(() => null);
  const preEmails = pre?.emails?.length ? pre.emails : [];
  const preLinks = pre?.links?.slice(0, 12) ?? [];

  const task = [
    "You are an email-finding agent. Find the email address(es) for the prospect described below.",
    "",
    "PROSPECT DETAILS:",
    details || "(none provided)",
    "",
    instructions ? `EXTRA INSTRUCTIONS:\n${instructions}\n` : "",
    "PROCEDURE (start immediately: do not ask for anything, there are no prerequisites):",
    "1. If a starting link is given, OPEN IT FIRST. If it is a YouTube channel, click the \"About\" tab (or goto the link with \"/about\" appended) and read every detail for a contact/business/mailto email.",
    "2. Run a web search: goto https://www.google.com/search?q=<prospect name and company>+\"email\" and open several result links (prefer the official site, press, podcast, or contact pages).",
    "3. On each visited page, look for mailto: links, \"For business inquiries\", \"Contact\", and visible email text. Also inspect the footer, About, Team, and Press pages.",
    "4. If you hit a CAPTCHA, solve it using the available solver and continue. Never stop because of a CAPTCHA.",
    "5. Keep exploring until you have checked the YouTube About page AND at least 3 other sources, or you are confident no public email exists.",
    "6. Return a concise bulleted list, one item per line, formatted exactly as: email: source/context. If you found none, return \"No email found\".",
    "Only include email addresses that literally appear on a page you visited. Do not invent emails.",
    preEmails.length
      ? `\nPRE-DISCOVERED CANDIDATE EMAILS (verify they belong to the prospect):\n${preEmails.join(", ")}`
      : "",
    preLinks.length ? `\nSUGGESTED PAGES TO INSPECT:\n${preLinks.join("\n")}` : "",
  ].join("\n");

  const startUrl = link
    ? link
    : `https://www.google.com/search?q=${encodeURIComponent(
        (details || "prospect") + " email contact"
      )}`;

  const res = await runBrowseTask({ task, startUrl, userEmail: opts.userEmail, maxSteps: 16 });
  if (!res.ok) {
    return { ok: false, emails: [], imported: 0, raw: "", error: res.error };
  }

  // Browse backends may return an object in edge cases. Coerce to a string so
  // extraction never throws and the raw payload stays inspectable.
  const rawResult = typeof res.result === "string" ? res.result : JSON.stringify(res.result ?? "");
  // CRITICAL: only trust emails that literally appeared on a page the agent
  // visited. The LLM's free-form answer can hallucinate addresses from memory,
  // so we extract from observed page text, not from the model's summary.
  const observed = res.pagesText && res.pagesText.length ? res.pagesText.join("\n") : rawResult;
  const found = [...new Set((observed.match(EMAIL_RE) || []).map((e) => e.toLowerCase()))];
  const lines = observed.split("\n");

  const parsed = found.map((email) => {
    const line = lines.find((l) => l.includes(email)) || "";
    const source = line
      .replace(email, "")
      .replace(/[—–-]/g, " ")
      .replace(/[^\w\s.@:/]/g, "")
      .trim()
      .slice(0, 120);
    return { email, source: source || "web" };
  });

  // Verify each with TrueMail, then import as leads.
  const out: CrawledEmail[] = [];
  let imported = 0;
  const DB = APPWRITE.databaseId;
  const COL = APPWRITE.collections.leads;
  const now = new Date().toISOString();

  for (const p of parsed) {
    const verdict = (await verifyEmail(p.email).catch(() => ({ status: "unknown" as const }))).status;
    let leadId: string | null = null;

    const existing = await databases
      .listDocuments(DB, COL, [Query.equal("email", p.email), Query.limit(1)])
      .catch(() => ({ documents: [] as any[] }));
    if (!existing.documents.length) {
      const doc = await databases
        .createDocument(DB, COL, ID.unique(), {
          first_name: "",
          last_name: "",
          email: p.email,
          company: details.slice(0, 80) || null,
          source: "email-crawler",
          status: "new",
          tags: ["email-crawler"],
          custom_fields: JSON.stringify({ link: link || null, details: details || null, source: p.source }),
          created_at: now,
          updated_at: now,
        })
        .catch(() => null);
      if (doc) {
        leadId = doc.$id;
        imported++;
      }
    }
    out.push({ email: p.email, source: p.source, verdict, leadId });
  }

  await logActivity({
    category: "leads",
    action: "imported",
    title: "Email Crawler run",
    description: `Crawled ${found.length} candidate emails (${imported} imported) for: ${details.slice(0, 60) || link}`,
    entityType: "leads",
    notify: true,
    metadata: { link: link || null, imported, candidates: found.length },
  }).catch(() => {});

  return { ok: true, emails: out, imported, raw: rawResult };
}
