export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PERSONALIZED_COLUMN_NAMES = [
  "personalized information",
  "personalized info",
  "personalisation",
  "personalized message",
  "personal info",
  "personalised information",
  "personalised info",
  "personalised message",
];

export function isPersonalizedColumn(header: string): boolean {
  const h = header.trim().toLowerCase();
  return PERSONALIZED_COLUMN_NAMES.includes(h);
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])([a-z]*)/g, (_m, a: string, b: string) => a.toUpperCase() + b);
}

export type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  position: string;
  personalizedInfo: string;
};

let idCounter = 0;
function newId() {
  idCounter += 1;
  return `l-${Date.now()}-${idCounter}`;
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

export function parseLeadCsv(text: string): Lead[] {
  const rows = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (rows.length === 0) return [];
  const header = parseLine(rows[0]).map((h) => h.toLowerCase());
  const firstIdx = header.findIndex((h) => h.includes("first") || h === "firstname");
  const lastIdx = header.findIndex((h) => h.includes("last") || h === "lastname");
  const emailIdx = header.findIndex((h) => h.includes("email"));
  const companyIdx = header.findIndex(
    (h) => h.includes("company") || h.includes("organization") || h === "org"
  );
  const positionIdx = header.findIndex(
    (h) => h.includes("position") || h.includes("role") || h.includes("title")
  );
  const personalIdx = header.findIndex((h) => isPersonalizedColumn(h));
  if (emailIdx === -1) {
    throw new Error("CSV must include an 'Email' column");
  }

  const out: Lead[] = [];
  const seen = new Set<string>();
  for (let r = 1; r < rows.length; r++) {
    const cells = parseLine(rows[r]);
    const email = (cells[emailIdx] ?? "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    out.push({
      id: newId(),
      firstName: firstIdx >= 0 ? titleCase((cells[firstIdx] ?? "").trim()) : "",
      lastName: lastIdx >= 0 ? titleCase((cells[lastIdx] ?? "").trim()) : "",
      email,
      company: companyIdx >= 0 ? (cells[companyIdx] ?? "").trim() : "",
      position: positionIdx >= 0 ? (cells[positionIdx] ?? "").trim() : "",
      personalizedInfo: personalIdx >= 0 ? (cells[personalIdx] ?? "").trim() : "",
    });
  }
  return out;
}

export function buildEmptyLead(): Lead {
  return {
    id: newId(),
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    position: "",
    personalizedInfo: "",
  };
}
