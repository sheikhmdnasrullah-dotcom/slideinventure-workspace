const SPINTAX_RE = /\{([^{}]+)\}/g;
const VARIABLE_RE = /\{\{\s*\.([A-Za-z0-9_]+)\s*\}\}/g;

export type SpintaxPreview = {
  text: string;
  variations: string[];
};

function pickOne(options: string[], seed?: number): string {
  if (options.length === 0) return "";
  const idx = seed !== undefined ? seed % options.length : Math.floor(Math.random() * options.length);
  return options[idx];
}

function splitSpintaxOptions(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (ch === "|" && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim());
}

export function expandSpintax(text: string, seed?: number): string {
  if (!text) return text;
  return text.replace(SPINTAX_RE, (_match, body: string) => {
    const options = splitSpintaxOptions(body);
    if (options.length === 0) return `{${body}}`;
    return pickOne(options, seed);
  });
}

export function previewSpintax(text: string, count: number = 5): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  const max = Math.max(count * 4, 20);
  while (out.length < count && attempts < max) {
    const expanded = expandSpintax(text, attempts);
    if (!seen.has(expanded)) {
      seen.add(expanded);
      out.push(expanded);
    }
    attempts++;
  }
  if (out.length < count) {
    const fallback = expandSpintax(text, 0);
    while (out.length < count) out.push(fallback);
  }
  return out;
}

export type LeadVariables = Record<string, string | undefined>;

export function substituteVariables(text: string, vars: LeadVariables): string {
  if (!text) return text;
  return text.replace(VARIABLE_RE, (_match, name: string) => {
    const v = vars[name];
    if (v === undefined || v === null || v === "") {
      return `there`;
    }
    return String(v);
  });
}

export function countLinks(text: string): number {
  if (!text) return 0;
  const urlRe = /(https?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+)/gi;
  return (text.match(urlRe) ?? []).length;
}

export function renderPersonalized(
  text: string,
  vars: LeadVariables,
  spintaxSeed?: number
): string {
  const expanded = expandSpintax(text, spintaxSeed);
  return substituteVariables(expanded, vars);
}

export function renderPreview(
  text: string,
  vars: LeadVariables,
  count: number = 3
): SpintaxPreview {
  const variations = previewSpintax(text, count).map((v) => substituteVariables(v, vars));
  const first = variations[0] ?? substituteVariables(expandSpintax(text, 0), vars);
  return { text: first, variations };
}

export const SUPPORTED_VARIABLES = [
  "FirstName",
  "LastName",
  "Email",
  "Position",
  "Company",
  "PersonalizedInfo",
] as const;

export type SupportedVariable = (typeof SUPPORTED_VARIABLES)[number];

export function variableChip(name: SupportedVariable): string {
  return `{{.${name}}}`;
}
