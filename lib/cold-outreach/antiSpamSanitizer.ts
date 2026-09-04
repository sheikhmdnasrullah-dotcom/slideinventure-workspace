/**
 * Anti-Spam Sanitizer & Auto-Replacer Engine
 *
 * Scans outreach email/subject text for spam trigger words, high-pressure
 * marketing phrases, and aggressive formatting, and automatically replaces
 * them with natural, conversational, inbox-safe equivalents.
 *
 * Preserves spintax `{Option1|Option2}` and GoPhish dynamic tags
 * `{{.FirstName}}` without corrupting template syntax.
 */

export type SpamCategory = "financial" | "urgency" | "cta" | "formatting";

export interface SpamViolation {
  trigger: string;
  replacement: string;
  category: SpamCategory;
  index: number;
}

export interface SanitizeResult {
  sanitizedText: string;
  violationsFound: SpamViolation[];
  safetyScore: number;
}

export const SPAM_REPLACEMENT_MAP: Record<string, string> = {
  "100% free": "complimentary",
  "totally free": "complimentary",
  "free trial": "sample preview",
  "make money": "generate revenue",
  "double your income": "improve performance",
  "triple your revenue": "scale performance",
  "guaranteed": "proven",
  "100% guaranteed": "proven",
  "risk-free": "straightforward",
  "risk free": "straightforward",
  "lowest price": "cost-effective",
  "cheap": "affordable",
  "pure profit": "net efficiency",
  "no hidden fees": "transparent details",
  "no catch": "transparent details",
  "no credit card required": "no commitment required",
  "instant cash": "streamlined returns",
  "easy money": "streamlined returns",
  "millionaire": "scale effectively",
  "get rich": "scale effectively",
  "act now": "when you have a moment",
  "urgent": "time-sensitive",
  "urgently": "time-sensitive",
  "limited time offer": "currently open",
  "limited time": "currently open",
  "don't miss out": "worth a quick look",
  "do not miss out": "worth a quick look",
  "call now": "let's connect",
  "call immediately": "let's connect",
  "expires today": "available this week",
  "expiring soon": "available this week",
  "last chance": "final follow-up",
  "final offer": "final follow-up",
  "apply now": "take a look at the details",
  "exclusive deal": "tailored overview",
  "special promotion": "tailored overview",
  "once in a lifetime": "unique opportunity",
  "click here": "here is the link",
  "click below": "you can find the overview here",
  "tap this link": "watch the short preview here",
  "open immediately": "take a look when you are free",
  "buy now": "get started",
  "order now": "get started",
  "winner": "relevant for your team",
  "you have won": "relevant for your team",
  "revolutionary": "systematic",
  "miracle": "systematic",
  "unbelievable": "notable",
  "congratulations": "reaching out because",
};

const CATEGORY_BY_TRIGGER: Record<string, SpamCategory> = {
  "100% free": "financial",
  "totally free": "financial",
  "free trial": "financial",
  "make money": "financial",
  "double your income": "financial",
  "triple your revenue": "financial",
  "guaranteed": "financial",
  "100% guaranteed": "financial",
  "risk-free": "financial",
  "risk free": "financial",
  "lowest price": "financial",
  "cheap": "financial",
  "pure profit": "financial",
  "no hidden fees": "financial",
  "no catch": "financial",
  "no credit card required": "financial",
  "instant cash": "financial",
  "easy money": "financial",
  "millionaire": "financial",
  "get rich": "financial",
  "act now": "urgency",
  "urgent": "urgency",
  "urgently": "urgency",
  "limited time offer": "urgency",
  "limited time": "urgency",
  "don't miss out": "urgency",
  "do not miss out": "urgency",
  "call now": "urgency",
  "call immediately": "urgency",
  "expires today": "urgency",
  "expiring soon": "urgency",
  "last chance": "urgency",
  "final offer": "urgency",
  "apply now": "urgency",
  "exclusive deal": "urgency",
  "special promotion": "urgency",
  "once in a lifetime": "urgency",
  "click here": "cta",
  "click below": "cta",
  "tap this link": "cta",
  "open immediately": "cta",
  "buy now": "cta",
  "order now": "cta",
  "winner": "cta",
  "you have won": "cta",
  "revolutionary": "cta",
  "miracle": "cta",
  "unbelievable": "cta",
  "congratulations": "cta",
};

const ALLOWED_ACRONYMS = new Set([
  "SEO", "CEO", "CTO", "CFO", "VP", "ROI", "AI", "SAAS", "B2B", "B2C", "CRM",
  "API", "URL", "HTTP", "HTTPS", "JSON", "XML", "HTML", "CSS", "JS", "TS",
  "SQL", "REST", "SMTP", "IMAP", "DNS", "CDN", "PDF", "CSV", "UI", "UX",
  "SPA", "SSR", "SSG", "MVP", "ARR", "MRR", "LTV", "CTR", "CPC", "CPM",
  "EOD", "EOW", "FYI", "ASAP", "ETA", "KPI", "OKR", "PLG", "POC", "SDK",
  "SLA", "SLO", "TBD", "TLDR", "WIP", "QA", "QC", "IT", "HR", "PR",
  "TAM", "ICP", "ABM", "MQL", "SQL", "SDR", "BDR",
]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function preserveCase(original: string, replacement: string): string {
  if (original === original.toUpperCase() && original.length > 1) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  if (original === original.toLowerCase()) {
    return replacement;
  }
  return replacement;
}

export function sanitizeOutreachEmail(rawText: string): SanitizeResult {
  let text = rawText ?? "";
  const violationsFound: SpamViolation[] = [];

  text = text.replace(/!{2,}/g, ".");
  text = text.replace(/\?{2,}/g, "?");
  text = text.replace(/(\?!|!\?)/g, "?");
  text = text.replace(/\${2,}/g, "$");

  const entries = Object.entries(SPAM_REPLACEMENT_MAP).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [trigger, replacement] of entries) {
    const escaped = escapeRegExp(trigger);
    const regex = new RegExp(`(^|[^\\w])(${escaped})(?=$|[^\\w])`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const matched = match[2];
      const idx = match.index + match[1].length;
      violationsFound.push({
        trigger,
        replacement,
        category: CATEGORY_BY_TRIGGER[trigger] ?? "cta",
        index: idx,
      });
      const preserved = preserveCase(matched, replacement);
      text = text.slice(0, idx) + preserved + text.slice(idx + matched.length);
      regex.lastIndex = idx + preserved.length;
    }
  }

  text = text.replace(/\b[A-Z]{3,}\b/g, (word) => {
    if (ALLOWED_ACRONYMS.has(word)) return word;
    return word.charAt(0) + word.slice(1).toLowerCase();
  });

  const safetyScore = Math.max(0, 100 - violationsFound.length * 15);

  return {
    sanitizedText: text,
    violationsFound,
    safetyScore,
  };
}

export function sanitizeSubjectLine(rawSubject: string): SanitizeResult {
  let subject = (rawSubject ?? "").trim();

  subject = subject.replace(/^(re:|fwd:)\s*/i, "");

  subject = subject.replace(/!{2,}/g, "");
  subject = subject.replace(/\?{2,}/g, "?");

  const lowered = subject.toLowerCase();
  if (lowered !== subject) {
    subject = subject.charAt(0).toUpperCase() + subject.slice(1).toLowerCase();
  }

  const result = sanitizeOutreachEmail(subject);

  const wordCount = subject.split(/\s+/).filter(Boolean).length;
  if (wordCount > 8) {
    result.violationsFound.push({
      trigger: `subject has ${wordCount} words`,
      replacement: "shorten to 3-6 words",
      category: "formatting",
      index: 0,
    });
    result.safetyScore = Math.max(0, result.safetyScore - 10);
  }

  return result;
}

export const SPAM_TRIGGERS_FOR_HIGHLIGHT = Object.keys(SPAM_REPLACEMENT_MAP);
