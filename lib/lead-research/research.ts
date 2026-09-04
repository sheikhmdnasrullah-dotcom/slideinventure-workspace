import "server-only";
import { getAgentRoster } from "@/lib/agents/roster";
import { RESEARCH_PERSONAS } from "@/lib/agents/research/personas";
import { chatCompletion } from "@/lib/llm/gateway";
import { searchTavily } from "@/lib/cold-outreach/tavily";
import { getSession, updateSession } from "./store";
import type { LeadResearchRow } from "./types";

const LINES_PER_LEAD = 4;
const MAX_USED_LINES = 120; // uniqueness memory cap to avoid unbounded prompts

// Build the "research team": every installed roster agent plus the built-in
// research personas. Each lead uses a rotating subset so the whole team is
// meaningfully engaged across the list.
export function getResearchTeam(): { slug: string; name: string }[] {
  const roster = getAgentRoster().map((a) => ({ slug: a.slug, name: a.name }));
  const personas = RESEARCH_PERSONAS.map((p) => ({ slug: p.slug, name: p.name }));
  const seen = new Set<string>();
  const team: { slug: string; name: string }[] = [];
  for (const a of [...personas, ...roster]) {
    if (seen.has(a.slug)) continue;
    seen.add(a.slug);
    team.push(a);
  }
  return team;
}

function buildLeadResearchQuery(lead: {
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  position?: string;
}): string {
  const parts: string[] = [];
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
  if (name) parts.push(name);
  if (lead.company) parts.push(lead.company);
  if (lead.position) parts.push(lead.position);
  if (lead.email) {
    const domain = lead.email.split("@")[1];
    if (domain && !parts.some((p) => p.includes(domain))) {
      parts.push(domain);
    }
  }
  if (lead.email) parts.push(lead.email);
  return parts.join(" ");
}

function buildSystemPrompt(agentName: string): string {
  return `You are ${agentName}, a lead research analyst on a personalization team. You produce the "Personalized Information" column used to write outreach that feels individually written for each person.

You will be given a lead (email + whatever basic fields we have) and real search snippets returned from the web about that person. Write ${LINES_PER_LEAD} distinct, natural sentences (3-4 lines) of hyper-personalized information about THIS person only.

STRICT RULES:
1. GROUND EVERY CLAIM IN THE SNIPPETS OR THE GIVEN LEAD FIELDS. Never invent names, titles, companies, events, or achievements. If a snippet is thin, say something true but low-risk (e.g. about their visible role/domain) and keep it short.
2. Each of the lines must be a separate bullet, preceded by "- ".
3. NO two leads in the whole list may share the same wording. A list of lines already used for other leads is provided ("ALREADY USED LINES"). Your lines must be textually distinct from all of them — different facts, different phrasing, different structure. If your only option repeats something already used, reword it so it is clearly unique.
4. Keep it conversational and professional. No spam words ("guaranteed", "act now", "100% free", etc.). No HTML, no markdown headers, no bullet markers other than the leading "- ".
5. Do not fabricate an email or personal contact info.
6. Output ONLY the ${LINES_PER_LEAD} bullets, no preamble or explanation.`;
}

function buildUserPrompt(
  lead: LeadResearchRow,
  snippets: string[],
  usedLines: string[]
): string {
  return `LEAD:
Email: ${lead.email}
First Name: ${lead.firstName || "(unknown)"}
Last Name: ${lead.lastName || "(unknown)"}
Company: ${lead.company || "(unknown)"}
Position: ${lead.position || "(unknown)"}

SEARCH RESULTS (real web snippets found for this person):
${
  snippets.length > 0
    ? snippets.map((s, i) => `[${i + 1}] ${s}`).join("\n\n")
    : "(none) — base the lines only on the lead fields above."
}

ALREADY USED LINES (from other leads — yours must differ from every one of these):
${
  usedLines.length > 0
    ? usedLines.map((l) => `- ${l}`).join("\n")
    : "(none yet — you are first)"
}

Write ${LINES_PER_LEAD} distinct personalized bullets for THIS person, each prefixed with "- ". Ground them in the search results and lead fields. They must not repeat the ALREADY USED LINES.`;
}

function extractBullets(text: string): string[] {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => l.replace(/^[-•*]\s*/, ""));
  if (lines.length >= 3) return lines.slice(0, LINES_PER_LEAD);
  // Fall back to sentence splitting if the model ignored bullets.
  const sentences = (text || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return sentences.slice(0, LINES_PER_LEAD);
}

export async function researchOne(
  lead: LeadResearchRow,
  agentName: string,
  usedLines: string[]
): Promise<{ personalizedInfo: string; snippets: string[] }> {
  const query = buildLeadResearchQuery(lead);
  let snippets: string[] = [];
  try {
    const [basic, advanced] = await Promise.allSettled([
      searchTavily(query, { maxResults: 5, searchDepth: "basic" }),
      searchTavily(`${lead.email} ${lead.company} ${lead.firstName}`, {
        maxResults: 5,
        searchDepth: "advanced",
      }),
    ]);
    const merge = (r: PromiseSettledResult<{ results: { title: string; content: string; url?: string }[] }>) =>
      r.status === "fulfilled"
        ? r.value.results.map((s) => `${s.title} — ${s.content}`)
        : [];
    snippets = [...merge(basic), ...merge(advanced)]
      .filter((s) => s.trim().length > 0)
      .slice(0, 8);
  } catch {
    snippets = [];
  }

  const systemPrompt = buildSystemPrompt(agentName);
  const userPrompt = buildUserPrompt(lead, snippets, usedLines.slice(-MAX_USED_LINES));

  let bullets: string[] = [];
  try {
    const response = await chatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 500, temperature: 0.8 }
    );
    bullets = extractBullets(response);
  } catch {
    bullets = [];
  }

  if (bullets.length === 0) {
    bullets = snippetFallback(lead, snippets);
  }

  return {
    personalizedInfo: bullets.join("\n"),
    snippets,
  };
}

function snippetFallback(lead: LeadResearchRow, snippets: string[]): string[] {
  const base: string[] = [];
  if (lead.firstName) {
    base.push(`${lead.firstName} is the contact point at ${lead.company || lead.email.split("@")[1] || "their organization"}.`.trim());
  }
  if (snippets.length > 0) {
    base.push(`Public records show information about ${lead.firstName || "this person"} is available online.`);
  }
  if (base.length < LINES_PER_LEAD) {
    const fillers = [
      `The best way to reach them is at ${lead.email}.`,
      `They operate within the ${lead.company ? `${lead.company} domain` : "public web"}.`,
    ];
    while (base.length < LINES_PER_LEAD && fillers.length > 0) {
      base.push(fillers.shift()!);
    }
  }
  return base.slice(0, LINES_PER_LEAD);
}

// Run the full enrichment over a session's rows, persisting progress after
// every lead so the UI can poll and watch the agents work through the list.
export async function runResearchSession(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;
  if (session.status === "running" || session.status === "done") return;

  const team = getResearchTeam();
  const agentPool =
    team.length > 0 ? team : [{ slug: "lead-research-assistant", name: "Lead Research Assistant" }];

  const rows = [...session.rows];
  await updateSession(sessionId, { status: "running" });

  // Seed the uniqueness memory with any lines that already exist.
  const usedLines = new Set<string>();
  for (const r of rows) {
    if (!r.personalizedInfo) continue;
    for (const line of r.personalizedInfo.split(/\r?\n/)) {
      const t = line.trim();
      if (t) usedLines.add(t);
    }
  }

  let idx = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Skip only leads that already have finished, enriched info. Stale rows
    // stuck in "researching" are retried so a re-run always completes the list.
    if (row.status === "done" && row.personalizedInfo) continue;

    const agent = agentPool[idx % agentPool.length];
    idx += 1;

    rows[i] = { ...row, status: "researching" };
    await updateSession(sessionId, { rows });

    try {
      const { personalizedInfo, snippets } = await researchOne(
        row,
        agent.name,
        Array.from(usedLines)
      );
      const newLines = personalizedInfo
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      for (const l of newLines) usedLines.add(l);

      rows[i] = {
        ...rows[i],
        personalizedInfo,
        researchSnippets: snippets,
        status: "done",
      };
    } catch (e) {
      rows[i] = {
        ...rows[i],
        status: "error",
        error: e instanceof Error ? e.message : "Research failed",
      };
    }

    const doneCount = rows.filter((r) => r.status !== "pending" && r.status !== "researching").length;
    await updateSession(sessionId, {
      rows,
      progress: rows.length > 0 ? doneCount / rows.length : 0,
      doneCount,
    });
  }

  await updateSession(sessionId, { status: "done", progress: 1, doneCount: rows.length });
}
