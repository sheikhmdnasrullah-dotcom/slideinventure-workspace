// Smart per-row link detection for the Email Crawler's CSV bulk mode. A row
// from an arbitrary CSV can carry a YouTube channel, a LinkedIn/Facebook/
// Instagram/X profile, a plain company website, or nothing but a name — this
// scans every cell (not just cells under a specific header name) so it works
// regardless of how the source CSV labeled its columns.

export type DetectedLinkType = "youtube" | "website" | "linkedin" | "facebook" | "instagram" | "twitter" | "tiktok" | "none";

export type RowDetection = {
  type: DetectedLinkType;
  link: string | null;
  details: string;
};

// Priority when a row has more than one link: YouTube first (dedicated
// extractor), then a plain company website (best signal for Pattern Verifier/
// OSINT Harvester, which both need a real domain), then social profiles
// (weakest direct signal, no public "view email" mechanism on most of these).
const PRIORITY: DetectedLinkType[] = ["youtube", "website", "linkedin", "facebook", "instagram", "twitter", "tiktok"];

const URL_RE = /https?:\/\/[^\s,"'<>]+/gi;
// Bare domains without a scheme (e.g. "acme.com" or "linkedin.com/in/x") —
// common in hand-edited spreadsheets. Deliberately conservative: requires a
// real TLD-shaped ending, and at least one path/slash OR a known social host,
// so a plain word like "Acme.co" in a company-name column isn't misread.
const BARE_DOMAIN_RE = /\b((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s,"'<>]*)?)\b/gi;

function classifyHost(host: string): DetectedLinkType {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (h === "youtube.com" || h === "youtu.be" || h === "m.youtube.com") return "youtube";
  if (h === "linkedin.com" || h === "lnkd.in") return "linkedin";
  if (h === "facebook.com" || h === "fb.com" || h === "fb.watch" || h === "m.facebook.com") return "facebook";
  if (h === "instagram.com") return "instagram";
  if (h === "twitter.com" || h === "x.com") return "twitter";
  if (h === "tiktok.com") return "tiktok";
  return "website";
}

function normalizeUrl(raw: string): string {
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

function extractUrls(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(URL_RE)) found.push(m[0].replace(/[.,;)]+$/, ""));
  if (found.length) return found;
  // Only fall back to bare-domain sniffing when no scheme'd URL exists at all
  // in this cell, so "https://acme.com" never also matches as a second, bare
  // duplicate via the second regex.
  for (const m of text.matchAll(BARE_DOMAIN_RE)) {
    const candidate = m[1];
    const host = candidate.split("/")[0];
    // Require either a path segment or a recognized social host — bare
    // "acme.com" with nothing else is still accepted (it's the single most
    // common real case: a "Website" column with just the domain), but this
    // keeps things like "v2.0" or "e.g." from matching.
    if (candidate.includes("/") || classifyHost(host) !== "website" || /\.(com|net|org|io|co|ai|dev|app|biz|us|uk|ca)$/i.test(host)) {
      found.push(candidate);
    }
  }
  return found;
}

/**
 * Scans every value in a CSV row for a usable link, classifies it, and builds
 * a details string from everything else in the row for the agents that don't
 * need a link (or that benefit from extra context alongside one).
 */
export function detectRowLink(row: Record<string, string>): RowDetection {
  const candidates: { type: DetectedLinkType; link: string }[] = [];
  const textParts: string[] = [];

  for (const [header, rawValue] of Object.entries(row)) {
    const value = (rawValue ?? "").toString().trim();
    if (!value) continue;

    const urls = extractUrls(value);
    if (urls.length) {
      for (const u of urls) {
        const normalized = normalizeUrl(u);
        let host: string;
        try {
          host = new URL(normalized).hostname;
        } catch {
          continue;
        }
        candidates.push({ type: classifyHost(host), link: normalized });
      }
      // A link-bearing cell is still useful as readable context (e.g. a
      // "LinkedIn" column even when YouTube wins as the primary link).
      textParts.push(`${header}: ${value}`);
    } else {
      textParts.push(`${header}: ${value}`);
    }
  }

  let best: { type: DetectedLinkType; link: string } | null = null;
  for (const wanted of PRIORITY) {
    const hit = candidates.find((c) => c.type === wanted);
    if (hit) {
      best = hit;
      break;
    }
  }

  return {
    type: best?.type ?? "none",
    link: best?.link ?? null,
    details: textParts.join(" | ").slice(0, 2000),
  };
}
