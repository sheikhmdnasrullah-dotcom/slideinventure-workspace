import { countLinks, substituteVariables } from "./spintax";
import { SPAM_REPLACEMENT_MAP } from "./antiSpamSanitizer";

export type DeliverabilityIssue = {
  level: "error" | "warning" | "info";
  message: string;
  category: "spam" | "subject" | "links" | "auth" | "length";
};

export type DeliverabilityReport = {
  score: number;
  issues: DeliverabilityIssue[];
  spamWordCount: number;
  linkCount: number;
  subjectWordCount: number;
  allCapsWords: string[];
  hasAllCapsSubject: boolean;
  hasExcessivePunctuation: boolean;
  authHealth: AuthHealth;
};

export type AuthHealth = {
  domains: DomainHealth[];
  overall: "ok" | "warn" | "fail";
};

export type DomainHealth = {
  domain: string;
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
  mtaSts: boolean;
  tlsRpt: boolean;
};

const PROTECTED_DOMAINS: DomainHealth[] = [
  {
    domain: "tanim.social",
    spf: true,
    dkim: true,
    dmarc: true,
    mtaSts: true,
    tlsRpt: true,
  },
  {
    domain: "tanim.tech",
    spf: true,
    dkim: true,
    dmarc: true,
    mtaSts: true,
    tlsRpt: true,
  },
];

export function getAuthHealth(): AuthHealth {
  const allOk = PROTECTED_DOMAINS.every(
    (d) => d.spf && d.dkim && d.dmarc && d.mtaSts && d.tlsRpt
  );
  const anyOk = PROTECTED_DOMAINS.some(
    (d) => d.spf || d.dkim || d.dmarc
  );
  return {
    domains: PROTECTED_DOMAINS,
    overall: allOk ? "ok" : anyOk ? "warn" : "fail",
  };
}

const ALL_CAPS_RE = /\b[A-Z]{3,}\b/g;
const PUNCT_RE = /(!{2,}|\?{2,}|!\?|\?!)/g;

function findSpamWords(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  const lower = text.toLowerCase();
  for (const trigger of Object.keys(SPAM_REPLACEMENT_MAP)) {
    if (lower.includes(trigger.toLowerCase())) {
      found.add(trigger);
    }
  }
  return Array.from(found);
}

function findAllCapsWords(text: string): string[] {
  if (!text) return [];
  const matches = text.match(ALL_CAPS_RE);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

export function scoreDeliverability(input: {
  subject?: string;
  body: string;
  fallbackVars?: Record<string, string | undefined>;
}): DeliverabilityReport {
  const issues: DeliverabilityIssue[] = [];
  const subject = (input.subject ?? "").trim();
  const body = input.body ?? "";

  const spamWords = findSpamWords(`${subject}\n${body}`);
  if (spamWords.length > 0) {
    issues.push({
      level: "warning",
      message: `Spam triggers found: ${spamWords.slice(0, 5).join(", ")}${spamWords.length > 5 ? "…" : ""}`,
      category: "spam",
    });
  }

  const subjectWordCount = subject ? subject.split(/\s+/).filter(Boolean).length : 0;
  if (subject) {
    if (subjectWordCount > 8) {
      issues.push({
        level: "warning",
        message: `Subject line is ${subjectWordCount} words (optimal: 3-6)`,
        category: "subject",
      });
    } else if (subjectWordCount === 0) {
      issues.push({
        level: "error",
        message: "Subject line is required",
        category: "subject",
      });
    }

    const hasAllCaps = /[A-Z]{3,}/.test(subject);
    if (hasAllCaps) {
      issues.push({
        level: "warning",
        message: "Subject line contains all-caps words",
        category: "subject",
      });
    }

    if (PUNCT_RE.test(subject)) {
      issues.push({
        level: "warning",
        message: "Subject line has excessive punctuation (!!, ??)",
        category: "subject",
      });
    }
  }

  const linkCount = countLinks(body);
  if (linkCount > 1) {
    issues.push({
      level: "warning",
      message: `Body contains ${linkCount} links (recommend max 1)`,
      category: "links",
    });
  }

  if (body.length > 1200) {
    issues.push({
      level: "info",
      message: "Body is long; consider trimming for plain-text outreach",
      category: "length",
    });
  }

  const fallbackPreview = subject || body ? substituteVariables(subject || body, input.fallbackVars ?? {}) : "";
  if (fallbackPreview.includes("there") && (subject.includes("{{") || body.includes("{{"))) {
    issues.push({
      level: "info",
      message: "Some personalization fields are missing — fallback \"there\" is used",
      category: "length",
    });
  }

  const allCapsWords = findAllCapsWords(`${subject} ${body}`);

  let score = 100;
  for (const issue of issues) {
    if (issue.level === "error") score -= 25;
    else if (issue.level === "warning") score -= 10;
    else score -= 3;
  }
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    issues,
    spamWordCount: spamWords.length,
    linkCount,
    subjectWordCount,
    allCapsWords,
    hasAllCapsSubject: /[A-Z]{3,}/.test(subject),
    hasExcessivePunctuation: PUNCT_RE.test(subject),
    authHealth: getAuthHealth(),
  };
}
