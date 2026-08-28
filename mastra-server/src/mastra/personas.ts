import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This project lives at <repo-root>/mastra-server/src/mastra/personas.ts.
// Personas are defined once, at <repo-root>/.claude/agents/*.md, and read
// directly from there — same source lib/agents/roster.ts reads in the main
// app — so there's exactly one place that defines what an agent is.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = path.resolve(__dirname, "..", "..", "..", ".claude", "agents");

export type Persona = {
  slug: string;
  name: string;
  emoji: string | null;
  color: string | null;
  instructions: string;
};

function parseFrontmatter(raw: string): { attrs: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { attrs: {}, body: raw };
  const attrs: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    attrs[m[1]] = value;
  }
  return { attrs, body: raw.slice(match[0].length) };
}

const SLUG_RE = /^[a-z0-9-]+$/;

export function loadPersonas(): Persona[] {
  if (!fs.existsSync(AGENTS_DIR)) return [];
  return fs
    .readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""))
    .filter((slug) => SLUG_RE.test(slug))
    .map((slug) => {
      const raw = fs.readFileSync(path.join(AGENTS_DIR, `${slug}.md`), "utf-8");
      const { attrs, body } = parseFrontmatter(raw);
      return {
        slug,
        name: attrs.name || slug,
        emoji: attrs.emoji || null,
        color: attrs.color || null,
        instructions: body.trim(),
      };
    });
}
