import "server-only";

import { execFile } from "node:child_process";

export interface AgentReachResult {
  title: string;
  url: string;
  content: string;
}

const EXEC_TIMEOUT_MS = 12000;
const MAX_CONTENT_CHARS = 1500;

function run(
  bin: string,
  args: string[],
  opts: { timeout?: number; maxBuffer?: number } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      {
        timeout: opts.timeout ?? EXEC_TIMEOUT_MS,
        maxBuffer: opts.maxBuffer ?? 512 * 1024,
      },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(String(stdout ?? ""));
      }
    );
  });
}

function cleanHostname(input: string): string | null {
  const host = input.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,18}$/.test(host)) return null;
  return host;
}

function truncate(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > MAX_CONTENT_CHARS ? t.slice(0, MAX_CONTENT_CHARS) + "…" : t;
}

/**
 * Read a company homepage through the agent-reach "web" channel
 * (Jina Reader). Returns [] on any failure: best-effort augmentation,
 * same contract as tavilySearch.
 */
export async function readCompanyPage(domain: string): Promise<AgentReachResult[]> {
  const host = cleanHostname(domain);
  if (!host) return [];
  try {
    const out = await run("/usr/bin/curl", [
      "-s",
      "-m",
      "12",
      `https://r.jina.ai/https://${host}`,
    ]);
    const content = truncate(out);
    if (content.length < 40) return [];
    return [{ title: host, url: `https://${host}`, content }];
  } catch {
    return [];
  }
}

/**
 * GitHub code/repo search through the agent-reach "dev" channel (gh CLI).
 * Needs `gh auth login` on the host; degrades to [] when gh is missing,
 * unauthenticated, or rate-limited.
 */
export async function searchGitHub(query: string): Promise<AgentReachResult[]> {
  if (!query.trim()) return [];
  try {
    const out = await run("/usr/bin/gh", [
      "search",
      "repos",
      query.trim().slice(0, 120),
      "--limit",
      "3",
      "--json",
      "nameWithOwner,description,url,stargazerCount",
    ]);
    const arr = JSON.parse(out) as Array<{
      nameWithOwner?: string;
      description?: string;
      url?: string;
      stargazerCount?: number;
    }>;
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 3).map((r) => ({
      title: String(r.nameWithOwner ?? ""),
      url: String(r.url ?? ""),
      content: truncate(
        `${r.description ?? ""} (${r.stargazerCount ?? 0} stars)`.trim()
      ),
    }));
  } catch {
    return [];
  }
}

export interface AgentReachLead {
  email?: string;
  company?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Combined agent-reach evidence for one lead, shaped like the Tavily
 * source in lead-research so researchOne can merge it directly:
 * company homepage (jina) + GitHub footprint (gh, when authed).
 */
export async function agentReachSnippets(
  lead: AgentReachLead
): Promise<{ results: { title: string; content: string; url?: string }[] }> {
  const domain =
    lead.company && lead.company.includes(".")
      ? lead.company
      : (lead.email ?? "").split("@")[1] ?? "";
  const person = [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  const [page, repos] = await Promise.all([
    domain ? readCompanyPage(domain) : Promise.resolve([]),
    person ? searchGitHub(`${person} ${domain}`.trim()) : Promise.resolve([]),
  ]);
  return { results: [...page, ...repos].slice(0, 4) };
}
