// Dynamic CSV header -> lead field inference.
//
// Replaces a fuzzy substring-scoring approach that had a real, reproducible
// bug: "first_name"'s alias list included the token "last" (aliases were
// meant to catch things like "given/forename" but a stray "last" token was
// in there too), and ties were broken by object-key insertion order. A
// header like "Lastname" or "LastName" (no space/underscore, so it missed
// the exact "Last Name" check) would score an equal match against both
// first_name and last_name on the substring "last", and first_name won the
// tie purely because it was declared first in the table — silently swapping
// first/last names on exactly the header variations this importer is
// supposed to handle.
//
// This version normalizes a header down to its bare alphanumeric characters
// (so "First Name" / "first_name" / "FirstName" / "first-name" all collapse
// to the identical string "firstname") and only maps a header to a field
// when it EXACTLY equals one of that field's known synonyms — no substring
// scoring, no ties, no cross-field collisions.

export type DedicatedField =
  | "first_name"
  | "last_name"
  | "full_name"
  | "email"
  | "phone"
  | "company"
  | "job_title"
  | "source"
  | "status"
  | "notes"
  | "tags";

// Recognized semantically, but the leads schema has no dedicated column for
// these — they're routed into custom_fields under a clean canonical key
// (e.g. every LinkedIn-ish header becomes custom_fields.linkedin) instead of
// either guessing at a dedicated field or keeping the raw, inconsistent
// header text as the key.
export type CustomField = "website" | "linkedin" | "location" | "country" | "industry";

export type FieldTarget =
  | { kind: "dedicated"; field: DedicatedField }
  | { kind: "custom"; field: CustomField }
  | { kind: "ignore" }
  | { kind: "unmapped" };

function normalizeHeader(header: string): string {
  return header
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

const DEDICATED_SYNONYMS: Record<DedicatedField, string[]> = {
  first_name: ["firstname", "fname", "givenname", "forename", "first"],
  last_name: ["lastname", "lname", "surname", "familyname", "family", "last"],
  full_name: ["fullname", "name", "contactname", "leadname", "personname"],
  email: ["email", "emailaddress", "emailid", "mail"],
  phone: ["phone", "phonenumber", "telephone", "mobile", "cell", "cellphone", "contactnumber", "tel"],
  company: ["company", "companyname", "organization", "organisation", "org", "employer", "business"],
  job_title: ["jobtitle", "title", "position", "role", "designation"],
  source: ["source", "leadsource", "origin", "channel"],
  status: ["status", "stage", "leadstatus"],
  notes: ["notes", "note", "description", "comments", "comment", "memo", "remarks"],
  tags: ["tags", "labels", "categories", "category"],
};

const CUSTOM_SYNONYMS: Record<CustomField, string[]> = {
  website: ["website", "url", "webpage", "site", "domain", "companywebsite"],
  linkedin: ["linkedin", "linkedinurl", "linkedinprofile", "linkedinlink"],
  location: ["location", "address", "city", "region"],
  country: ["country", "countryname", "nation"],
  industry: ["industry", "sector", "vertical", "niche"],
};

// Exact-match lookup table: normalized synonym -> target. Built once; a
// synonym belongs to exactly one field, so there's no scoring or tie-break
// to get wrong.
const EXACT_LOOKUP = new Map<string, FieldTarget>();
for (const [field, synonyms] of Object.entries(DEDICATED_SYNONYMS) as [DedicatedField, string[]][]) {
  for (const syn of synonyms) EXACT_LOOKUP.set(syn, { kind: "dedicated", field });
}
for (const [field, synonyms] of Object.entries(CUSTOM_SYNONYMS) as [CustomField, string[]][]) {
  for (const syn of synonyms) {
    if (!EXACT_LOOKUP.has(syn)) EXACT_LOOKUP.set(syn, { kind: "custom", field });
  }
}

export type HeaderMapping = Record<string, FieldTarget>;

// Infers a target for every header, each dedicated field claimed by at most
// one header (first occurrence wins) so two different columns never both
// try to write first_name, silently clobbering one of them.
export function inferFieldMapping(headers: string[]): HeaderMapping {
  const mapping: HeaderMapping = {};
  const claimedDedicated = new Set<DedicatedField>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const target = EXACT_LOOKUP.get(normalized);
    if (!target) {
      mapping[header] = { kind: "unmapped" };
      continue;
    }
    if (target.kind === "dedicated") {
      if (claimedDedicated.has(target.field)) {
        mapping[header] = { kind: "unmapped" };
        continue;
      }
      claimedDedicated.add(target.field);
    }
    mapping[header] = target;
  }

  return mapping;
}

export const DEDICATED_FIELD_OPTIONS: { value: DedicatedField; label: string }[] = [
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "full_name", label: "Full Name (auto-split)" },
  { value: "email", label: "Email" },
  { value: "company", label: "Company" },
  { value: "job_title", label: "Job Title" },
  { value: "phone", label: "Phone" },
  { value: "source", label: "Source" },
  { value: "status", label: "Status" },
  { value: "notes", label: "Notes" },
  { value: "tags", label: "Tags" },
];

export const CUSTOM_FIELD_OPTIONS: { value: CustomField; label: string }[] = [
  { value: "website", label: "Website" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "location", label: "Location" },
  { value: "country", label: "Country" },
  { value: "industry", label: "Industry" },
];

// Encodes a FieldTarget as the flat string the mapping <Select> already uses
// (e.g. "first_name", "custom:website", "ignore", ""), and back.
export function targetToSelectValue(target: FieldTarget): string {
  if (target.kind === "dedicated") return target.field;
  if (target.kind === "custom") return `custom:${target.field}`;
  if (target.kind === "ignore") return "ignore";
  return "";
}

export function selectValueToTarget(value: string): FieldTarget {
  if (!value || value === "unmapped") return { kind: "unmapped" };
  if (value === "ignore") return { kind: "ignore" };
  if (value.startsWith("custom:")) return { kind: "custom", field: value.slice(7) as CustomField };
  return { kind: "dedicated", field: value as DedicatedField };
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

// Applies a resolved mapping to one raw CSV row (header -> string value),
// producing a normalized lead object ready for /api/leads/import. Every
// header that isn't a dedicated/custom target, plus every recognized
// "custom" target, lands in custom_fields — nothing from the source row is
// ever silently dropped.
export function mapRowToLead(
  row: Record<string, string>,
  mapping: HeaderMapping
): Record<string, unknown> {
  const lead: Record<string, unknown> = {}
  const customFields: Record<string, unknown> = {}
  let fullName = "";

  for (const [header, rawValue] of Object.entries(row)) {
    const value = (rawValue ?? "").toString().trim();
    if (!value) continue;
    const target = mapping[header] ?? { kind: "unmapped" };

    if (target.kind === "ignore") continue;

    if (target.kind === "dedicated") {
      if (target.field === "full_name") {
        fullName = value;
      } else if (target.field === "tags") {
        lead.tags = value.split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        lead[target.field] = value;
      }
      continue;
    }

    if (target.kind === "custom") {
      customFields[target.field] = value;
      continue;
    }

    // Unmapped — preserve under its original header text so nothing from
    // the source CSV is discarded.
    customFields[header] = value;
  }

  if (fullName && !(lead.first_name && lead.last_name)) {
    const { firstName, lastName } = splitFullName(fullName);
    if (!lead.first_name) lead.first_name = firstName;
    if (!lead.last_name && lastName) lead.last_name = lastName;
  }

  if (Object.keys(customFields).length > 0) lead.custom_fields = customFields;
  return lead;
}
