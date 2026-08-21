import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { recordVersion } from "./versioning";
import { reindexChunks } from "./reindex";

export type SyncCounters = {
  created: string[];
  updated: string[];
  skipped: string[];
  failed: string[];
};

export type SyncResult = {
  success: boolean;
  counters: SyncCounters;
  output: string;
};

const REQUIRED_FIELDS = [
  "id",
  "type",
  "title",
  "tags",
  "status",
  "source",
  "author",
] as const;

type Row = {
  id: string;
  type: string;
  title: string;
  slug: string;
  content_path: string;
  body: string;
  status: string;
  source: string;
  author: string;
  tags: string[];
};

type ObsidianRow = Row & { wikilinks: string[] };

async function findMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => path.join(e.parentPath ?? e.path, e.name));
}

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseWikilinks(body: string): string[] {
  const links = new Set<string>();
  const re = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const target = m[1].trim().split("/").pop()?.trim();
    if (target) links.add(target);
  }
  return [...links];
}

function parseInlineTags(body: string): string[] {
  const tags = new Set<string>();
  const re = /(^|\s)#([a-zA-Z0-9_/-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    tags.add(m[2]);
  }
  return [...tags];
}

function toRow(filePath: string, raw: string): Row | { error: string } {
  const { data, content } = matter(raw);

  const missing = REQUIRED_FIELDS.filter((field) => data[field] === undefined);
  if (missing.length > 0) {
    return { error: `missing frontmatter field(s): ${missing.join(", ")}` };
  }
  if (!Array.isArray(data.tags)) {
    return { error: "frontmatter 'tags' must be a list" };
  }

  const slug = path.basename(filePath, ".md");

  return {
    id: String(data.id),
    type: String(data.type),
    title: String(data.title),
    slug,
    content_path: path.relative(process.cwd(), filePath),
    body: content.trim(),
    status: String(data.status),
    source: String(data.source),
    author: String(data.author),
    tags: data.tags,
  };
}

function toObsidianRow(filePath: string, raw: string): ObsidianRow | { error: string } {
  const { data, content } = matter(raw);
  const hasFrontmatter = Object.keys(data).length > 0;
  const slug = slugify(path.basename(filePath, ".md"));
  const inlineTags = parseInlineTags(content);
  const wikilinks = parseWikilinks(content);

  if (hasFrontmatter) {
    const missing = REQUIRED_FIELDS.filter((field) => data[field] === undefined);
    if (missing.length > 0) {
      return { error: `missing frontmatter field(s): ${missing.join(", ")}` };
    }
    if (!Array.isArray(data.tags)) {
      return { error: "frontmatter 'tags' must be a list" };
    }
    return {
      id: String(data.id),
      type: String(data.type),
      title: String(data.title),
      slug,
      content_path: path.relative(process.cwd(), filePath),
      body: content.trim(),
      status: String(data.status),
      source: String(data.source),
      author: String(data.author),
      tags: [...new Set([...data.tags, ...inlineTags])],
      wikilinks,
    };
  }

  return {
    id: `obsidian-${slug}`,
    type: "obsidian-note",
    title: path.basename(filePath, ".md"),
    slug,
    content_path: path.relative(process.cwd(), filePath),
    body: content.trim(),
    status: "proposed",
    source: "Obsidian vault",
    author: "",
    tags: inlineTags,
    wikilinks,
  };
}

function rowsDiffer(existing: Record<string, unknown>, next: Row): boolean {
  const fields: (keyof Row)[] = [
    "type",
    "title",
    "slug",
    "content_path",
    "body",
    "status",
    "source",
    "author",
    "tags",
  ];
  return fields.some((field) => {
    const a = existing[field];
    const b = next[field];
    return Array.isArray(b) ? JSON.stringify(a) !== JSON.stringify(b) : a !== b;
  });
}

async function upsertKnowledgeItem(
  supabase: SupabaseClient,
  relPath: string,
  parsed: Row,
  seenIds: Map<string, string>,
  counters: SyncCounters
): Promise<"created" | "updated" | "skipped" | "failed"> {
  const dupeOf = seenIds.get(parsed.id);
  if (dupeOf) {
    const msg = `FAILED  ${relPath}: duplicate id '${parsed.id}' also used by ${dupeOf}`;
    console.log(msg);
    counters.failed.push(relPath);
    return "failed";
  }
  seenIds.set(parsed.id, relPath);

  const { data: existing, error: fetchError } = await supabase
    .from("knowledge_items")
    .select("id, type, title, slug, content_path, content_type, body, status, source, author, tags, created_at, updated_at")
    .eq("id", parsed.id)
    .maybeSingle();

  if (fetchError) {
    console.log(`FAILED  ${relPath}: ${fetchError.message}`);
    counters.failed.push(relPath);
    return "failed";
  }

  if (!existing) {
    const { error } = await supabase.from("knowledge_items").insert(parsed);
    if (error) {
      console.log(`FAILED  ${relPath}: ${error.message}`);
      counters.failed.push(relPath);
      return "failed";
    }
    try {
      await reindexChunks(supabase, parsed.id, parsed.body);
    } catch (err) {
      console.log(`FAILED  ${relPath}: ${(err as Error).message}`);
      counters.failed.push(relPath);
      return "failed";
    }
    console.log(`CREATED ${relPath} (${parsed.id})`);
    counters.created.push(relPath);
    return "created";
  }

  if (!rowsDiffer(existing, parsed)) {
    console.log(`SKIPPED ${relPath} (${parsed.id}) — unchanged`);
    counters.skipped.push(relPath);
    return "skipped";
  }

  try {
    await recordVersion(supabase, parsed.id, existing, "sync");
  } catch (err) {
    console.log(`FAILED  ${relPath}: ${(err as Error).message}`);
    counters.failed.push(relPath);
    return "failed";
  }

  const { error } = await supabase
    .from("knowledge_items")
    .update({ ...parsed, updated_at: new Date().toISOString() })
    .eq("id", parsed.id);
  if (error) {
    console.log(`FAILED  ${relPath}: ${error.message}`);
    counters.failed.push(relPath);
    return "failed";
  }
  try {
    await reindexChunks(supabase, parsed.id, parsed.body);
  } catch (err) {
    console.log(`FAILED  ${relPath}: ${(err as Error).message}`);
    counters.failed.push(relPath);
    return "failed";
  }
  console.log(`UPDATED ${relPath} (${parsed.id})`);
  counters.updated.push(relPath);
  return "updated";
}

async function ensureEntity(supabase: SupabaseClient, id: string, type: string, name: string) {
  const { data: existing } = await supabase.from("entities").select("id").eq("id", id).maybeSingle();
  if (existing) return;
  const { error } = await supabase.from("entities").insert({ id, type, name });
  if (error) throw new Error(`entity '${id}': ${error.message}`);
}

async function ensureRelation(
  supabase: SupabaseClient,
  fromEntityId: string,
  toEntityId: string,
  relationType: string,
  sourceKnowledgeItemId: string
) {
  const { data: existing } = await supabase
    .from("relations")
    .select("id")
    .eq("from_entity_id", fromEntityId)
    .eq("to_entity_id", toEntityId)
    .eq("relation_type", relationType)
    .eq("source_knowledge_item_id", sourceKnowledgeItemId)
    .maybeSingle();
  if (existing) return;
  const { error } = await supabase.from("relations").insert({
    from_entity_id: fromEntityId,
    to_entity_id: toEntityId,
    relation_type: relationType,
    source_knowledge_item_id: sourceKnowledgeItemId,
  });
  if (error) throw new Error(`relation ${fromEntityId} -> ${toEntityId}: ${error.message}`);
}

async function syncWikilinks(supabase: SupabaseClient, note: ObsidianRow) {
  if (note.wikilinks.length === 0) return;
  await ensureEntity(supabase, note.id, note.type, note.title);
  for (const link of note.wikilinks) {
    const targetId = `obsidian-${slugify(link)}`;
    await ensureEntity(supabase, targetId, "obsidian-note", link);
    await ensureRelation(supabase, note.id, targetId, "LINKS_TO", note.id);
  }
}

export async function syncKnowledge(cwd: string): Promise<SyncResult> {
  const supabase: SupabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const knowledgeDir = path.join(cwd, "knowledge");
  const vaultDir = path.join(cwd, "SecondBrain");

  const startedAt = new Date().toISOString();
  let knowledgeFiles: string[] = [];
  let vaultFiles: string[] = [];

  try {
    knowledgeFiles = await findMarkdownFiles(knowledgeDir);
  } catch {
    // knowledge dir may not exist yet
  }

  try {
    vaultFiles = await findMarkdownFiles(vaultDir);
  } catch {
    // vault dir may not exist
  }

  const counters: SyncCounters = { created: [], updated: [], skipped: [], failed: [] };
  const seenIds = new Map<string, string>();

  for (const filePath of knowledgeFiles) {
    const relPath = path.relative(cwd, filePath);
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = toRow(filePath, raw);

    if ("error" in parsed) {
      console.log(`FAILED  ${relPath}: ${parsed.error}`);
      counters.failed.push(relPath);
      continue;
    }

    await upsertKnowledgeItem(supabase, relPath, parsed, seenIds, counters);
  }

  for (const filePath of vaultFiles) {
    const relPath = path.relative(cwd, filePath);
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = toObsidianRow(filePath, raw);

    if ("error" in parsed) {
      console.log(`FAILED  ${relPath}: ${parsed.error}`);
      counters.failed.push(relPath);
      continue;
    }

    const { wikilinks, ...dbRow } = parsed;
    const outcome = await upsertKnowledgeItem(supabase, relPath, dbRow, seenIds, counters);
    if (outcome === "failed") continue;

    try {
      await syncWikilinks(supabase, parsed);
    } catch (err) {
      console.log(`FAILED  ${relPath}: ${(err as Error).message}`);
      counters.failed.push(relPath);
    }
  }

  const output = `${counters.created.length} created, ${counters.updated.length} updated, ${counters.skipped.length} skipped, ${counters.failed.length} failed.`;

  console.log("");
  console.log(`Done. ${output}`);

  await supabase.from("task_runs").insert({
    id: randomUUID(),
    task_type: "system",
    status: counters.failed.length > 0 ? "failed" : "completed",
    command: "npm run sync",
    output,
    exit_code: counters.failed.length > 0 ? 1 : 0,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    triggered_by: "api",
    metadata: { counters },
  });

  return {
    success: counters.failed.length === 0,
    counters,
    output,
  };
}
