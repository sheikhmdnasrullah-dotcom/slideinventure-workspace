/**
 * Agent roster — reads the installed Claude Code subagent persona files
 * (`.claude/agents/*.md`, from github.com/msitarzewski/agency-agents) and
 * pairs each with its division/team from `agent-divisions.json`.
 *
 * This is a read-only reference catalog for the dashboard. It is unrelated
 * to the task_runs-backed AgentType/AgentRunner system in `./registry.ts`.
 */
import "server-only";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import divisionMap from "./agent-divisions.json";

const AGENTS_DIR = path.join(process.cwd(), ".claude", "agents");

export type RosterAgent = {
  slug: string;
  name: string;
  description: string;
  division: string;
  team: string | null;
  emoji: string | null;
  color: string | null;
};

const DIVISION_BY_SLUG = new Map(
  (divisionMap as { slug: string; division: string; team: string | null }[]).map((d) => [
    d.slug,
    d,
  ])
);

/**
 * A handful of upstream agent files have unquoted colons inside YAML scalar
 * values (e.g. "description: ...DX: intuitive..."), which breaks js-yaml's
 * plain-scalar parsing. Fall back to a line-based extraction rather than
 * losing the whole roster over one malformed file.
 */
function parseFrontmatter(raw: string): Record<string, unknown> {
  try {
    return matter(raw).data;
  } catch {
    const fm = raw.match(/^---\n([\s\S]*?)\n---/);
    const data: Record<string, unknown> = {};
    if (fm) {
      for (const line of fm[1].split("\n")) {
        const m = line.match(/^(\w+):\s*(.*)$/);
        if (m) data[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
    return data;
  }
}

export function getAgentRoster(): RosterAgent[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }

  const agents: RosterAgent[] = [];
  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    let raw: string;
    try {
      raw = fs.readFileSync(path.join(AGENTS_DIR, file), "utf8");
    } catch {
      continue;
    }
    const data = parseFrontmatter(raw);
    const meta = DIVISION_BY_SLUG.get(slug);
    agents.push({
      slug,
      name: typeof data.name === "string" ? data.name : slug,
      description: typeof data.description === "string" ? data.description : "",
      division: meta?.division ?? "specialized",
      team: meta?.team ?? null,
      emoji: typeof data.emoji === "string" ? data.emoji : null,
      color: typeof data.color === "string" ? data.color : null,
    });
  }

  return agents.sort((a, b) => a.name.localeCompare(b.name));
}

export function getAgentDivisions(agents: RosterAgent[]): string[] {
  return Array.from(new Set(agents.map((a) => a.division))).sort();
}
