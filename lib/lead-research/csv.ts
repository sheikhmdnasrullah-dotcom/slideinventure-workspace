import "server-only";
import { titleCase, EMAIL_RE } from "@/lib/cold-outreach/csv";
import type { LeadResearchRow } from "./types";

export const PERSONALIZED_COLUMN_NAMES = [
  "personalized information",
  "personalized info",
  "personalization",
  "personal info",
  "personalised information",
  "personalised info",
];

// Anything the research step should NOT treat as a personalization column.
const NON_PERSONALIZED_COLUMNS = new Set([
  "email",
  "first name",
  "firstname",
  "first_name",
  "last name",
  "lastname",
  "last_name",
  "company",
  "company name",
  "organization",
  "organization name",
  "org",
  "position",
  "job title",
  "jobtitle",
  "role",
  "title",
  "linkedin",
  "phone",
  "website",
  "source",
  "status",
  "id",
]);

export function isPersonalizedColumn(header: string): boolean {
  const h = header.trim().toLowerCase();
  return PERSONALIZED_COLUMN_NAMES.includes(h);
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function indexBy(header: string) {
  return normalizeHeader(header);
}

export type ParsedLeadCsv = {
  rows: LeadResearchRow[];
  discoveredColumns: string[];
  originalHeaders: string[];
};

let idCounter = 0;
function newId() {
  idCounter += 1;
  return `lr-${Date.now()}-${idCounter}`;
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

function findColumn(headers: string[], ...alternates: string[]): number {
  const wanted = new Set(alternates.map(indexBy));
  return headers.findIndex((h) => wanted.has(indexBy(h)));
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Parse a lead research CSV. Preserves firstName/lastName/company/position and
 * picks up an existing "Personalized Information" column if present.
 */
export function parseLeadResearchCsv(text: string): ParsedLeadCsv {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], discoveredColumns: [], originalHeaders: [] };
  }

  const headers = parseLine(lines[0]);

  const emailIdx = findColumn(headers, "email");
  const firstIdx = findColumn(headers, "first name", "firstname", "first_name");
  const lastIdx = findColumn(headers, "last name", "lastname", "last_name");
  const companyIdx = findColumn(headers, "company", "company name", "organization", "org");
  const positionIdx = findColumn(
    headers,
    "position",
    "job title",
    "jobtitle",
    "role",
    "title"
  );
  const personalIdx = headers.findIndex((h) => isPersonalizedColumn(h));

  if (emailIdx === -1) {
    throw new Error("CSV must include an 'Email' column");
  }

  const rows: LeadResearchRow[] = [];
  const seen = new Set<string>();
  for (let r = 1; r < lines.length; r++) {
    const cells = parseLine(lines[r]);
    const email = (cells[emailIdx] ?? "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);

    rows.push({
      id: newId(),
      email,
      firstName: firstIdx >= 0 ? titleCase((cells[firstIdx] ?? "").trim()) : "",
      lastName: lastIdx >= 0 ? titleCase((cells[lastIdx] ?? "").trim()) : "",
      company: companyIdx >= 0 ? (cells[companyIdx] ?? "").trim() : "",
      position: positionIdx >= 0 ? (cells[positionIdx] ?? "").trim() : "",
      personalizedInfo:
        personalIdx >= 0 ? (cells[personalIdx] ?? "").trim() : "",
      researchSnippets: [],
      status: "pending",
    });
  }

  const textHeaders = headers.map((h) => h.trim()).filter((h) => h.length > 0);
  const discoveredColumns = textHeaders.filter((h) => {
    const n = normalizeHeader(h);
    return (
      n.length > 0 &&
      !NON_PERSONALIZED_COLUMNS.has(n) &&
      !isPersonalizedColumn(h) &&
      !["email", "first name", "last name", "company", "position"].includes(n)
    );
  });

  return { rows, discoveredColumns, originalHeaders: textHeaders };
}

/**
 * Serialize a session's rows back to a CSV, always including a
 * "Personalized Information" column after the core columns.
 */
export function serializeLeadResearchCsv(rows: LeadResearchRow[]): string {
  const header = [
    "Email",
    "First Name",
    "Last Name",
    "Company",
    "Position",
    "Personalized Information",
  ];
  const lines = [header.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.email,
        row.firstName,
        row.lastName,
        row.company,
        row.position,
        row.personalizedInfo,
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }
  return lines.join("\n");
}
