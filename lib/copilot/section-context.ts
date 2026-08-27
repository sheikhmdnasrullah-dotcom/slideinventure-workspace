import {
  DASHBOARD_SECTIONS,
  type DashboardSectionId,
} from "@/lib/dashboard/navigation";

/**
 * Maps a dashboard pathname to a section descriptor the copilot can reason
 * about, derived from the real nav so the two never drift apart.
 */

export type CopilotSection = {
  id: string;
  label: string;
  route: string;
  /** Whether retrieval in this section should stay local or span the workspace. */
  searchScope: "section" | "global";
  /** Result `type` values from /api/search that belong to this section. */
  sources: string[];
};

/** Result types emitted by GET /api/search, in one place. */
export const SEARCH_TYPES_ALL = [
  "knowledge",
  "leads",
  "documents",
  "links",
  "research",
  "boards",
  "concepts",
  "terminal",
  "todoist",
  "notes",
] as const;

/** Per-section retrieval scope, keyed by nav id. */
const SOURCES_BY_ID: Record<string, string[]> = {
  "ai-venture": ["concepts", "notes", "ideas", "boards"],
  "research-lab": ["research", "notes", "documents"],
  knowledge: ["knowledge", "documents", "notes"],
  documents: ["documents", "notes"],
  leads: ["leads"],
  notepad: ["notes"],
  "brainstorm-sketch": ["boards", "ideas", "notes"],
  ideas: ["ideas", "boards", "notes"],
  terminal: ["terminal"],
  "useful-links": ["links"],
  todoist: ["todoist"],
};

/** Nav ids that are aggregate/dashboard surfaces and always search globally. */
const GLOBAL_IDS = new Set<DashboardSectionId>([
  "dashboard",
  "integrations",
  "chat",
  "agents",
  "vault",
  "settings",
  "email-crawler",
  "agent-canvas",
  "analytics",
  "ui-kit",
  "ai-chat",
  "mail-apps",
]);

function buildSection(section: (typeof DASHBOARD_SECTIONS)[number]): CopilotSection {
  const isGlobal = GLOBAL_IDS.has(section.id) || !SOURCES_BY_ID[section.id];
  return {
    id: section.id,
    label: section.label,
    route: section.route,
    searchScope: isGlobal ? "global" : "section",
    sources: SOURCES_BY_ID[section.id] ?? [...SEARCH_TYPES_ALL],
  };
}

export const COPILOT_SECTIONS: CopilotSection[] = DASHBOARD_SECTIONS.map(buildSection);

const BY_ID = new Map(COPILOT_SECTIONS.map((s) => [s.id, s]));
const BY_LABEL_LOWER = new Map(
  COPILOT_SECTIONS.map((s) => [s.label.toLowerCase(), s])
);

const DEFAULT_SECTION: CopilotSection = {
  id: "dashboard",
  label: "Dashboard",
  route: "/dashboard",
  searchScope: "global",
  sources: [...SEARCH_TYPES_ALL],
};

export function sectionForPathname(pathname: string): CopilotSection {
  const clean = pathname.split("?")[0].split("#")[0];
  const match = COPILOT_SECTIONS.find(
    (s) => clean === s.route || clean.startsWith(s.route + "/")
  );
  return match ?? DEFAULT_SECTION;
}

/** Resolve a free-form section id or label to its route, or null if unknown. */
export function routeForSection(input: string): string | null {
  if (!input) return null;
  const lower = input.toLowerCase();
  const byId = BY_ID.get(lower) ?? BY_ID.get(input);
  if (byId) return byId.route;
  const byLabel = BY_LABEL_LOWER.get(lower);
  if (byLabel) return byLabel.route;
  const partial = COPILOT_SECTIONS.find(
    (s) => s.label.toLowerCase().includes(lower) || s.id.includes(lower)
  );
  return partial?.route ?? null;
}
