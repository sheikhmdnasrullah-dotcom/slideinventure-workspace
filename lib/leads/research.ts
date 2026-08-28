import "server-only";
import { runBrowseTask } from "@/lib/browse/agent";
import { chatCompletion } from "@/lib/llm/gateway";
import { databases, ID, Query } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { logActivity } from "@/lib/activities/client";

/**
 * Lead Research Assistant: the generalized sibling of `harvestLeads`.
 *
 * `harvestLeads` only ever takes a YouTube niche string. This accepts whatever
 * the operator actually has — a loose description, a single partially-filled
 * lead, or a batch of CSV rows with arbitrary columns — and researches each
 * one with no required fields. Missing information is filled in by search,
 * not by asking the operator for it.
 *
 * Whichever LLM provider is configured (DeepSeek, LiteLLM, NVIDIA, OpenRouter
 * — see `lib/llm/gateway.ts` / `lib/llm/models.ts`) powers both the browse
 * agent's step-by-step reasoning and the no-browser fallback below, so this
 * needs no research-specific configuration of its own.
 */

export type ResearchedLead = {
  email: string
  first_name: string
  last_name: string
  company: string | null
  job_title: string | null
  source_note: string | null
}

export type ResearchRequest =
  | { mode: "describe"; text: string }
  | { mode: "rows"; rows: Record<string, string>[] }

export type ResearchOutcome = {
  ok: boolean
  created: number
  updated: number
  skipped: number
  leads: ResearchedLead[]
  error?: string
}

const LINE_RE = /^\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*$/
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

const OUTPUT_FORMAT =
  "Return one line per lead, formatted exactly as: email | first_name | last_name | company | job_title. " +
  "Use \"unknown\" for any field you genuinely cannot find. Never invent an email address — if you cannot find " +
  "a real one, omit that lead entirely. Return only the lines, nothing else."

function parseLines(raw: string): ResearchedLead[] {
  const out: ResearchedLead[] = []
  for (const line of raw.split("\n")) {
    const m = line.match(LINE_RE)
    if (!m) continue
    const email = m[1].trim().toLowerCase()
    if (!EMAIL_RE.test(email)) continue
    out.push({
      email,
      first_name: clean(m[2]),
      last_name: clean(m[3]),
      company: clean(m[4]) || null,
      job_title: clean(m[5]) || null,
      source_note: null,
    })
  }
  return out
}

function clean(v: string): string {
  const t = v.trim()
  return /^unknown$/i.test(t) ? "" : t
}

/** Best-effort reasoning pass with no web access, used when the browse agent
 * is unavailable or fails outright. Still produces a result from whatever
 * was given rather than erroring — the whole point of "no prerequisite". */
async function researchWithoutBrowsing(knownInfo: string): Promise<ResearchedLead[]> {
  const text = await chatCompletion(
    [
      {
        role: "system",
        content:
          "You help fill in likely professional details for a sales lead from partial information. " +
          "You have no internet access, so only include a lead if the given information already contains " +
          "or clearly implies a real, working email address. " +
          OUTPUT_FORMAT,
      },
      { role: "user", content: knownInfo },
    ],
    { temperature: 0.2 }
  ).catch(() => "")
  return parseLines(text)
}

async function researchOne(knownInfo: string, startUrl?: string): Promise<ResearchedLead[]> {
  const task =
    `Research this lead using whatever is already known: ${knownInfo}\n\n` +
    "Search the web (Google, LinkedIn, the company's own site) as needed to confirm or discover a real, " +
    "public contact email, full name, company and job title. " +
    OUTPUT_FORMAT

  const res = await runBrowseTask({ task, startUrl, maxSteps: 6 })
  if (res.ok) {
    const parsed = parseLines(res.result)
    if (parsed.length > 0) return parsed
  }
  // Browse agent unavailable, timed out, or found nothing parseable — fall
  // back to a no-browsing reasoning pass rather than surfacing an error.
  return researchWithoutBrowsing(knownInfo)
}

async function persistLead(lead: ResearchedLead, sourceTag: string): Promise<"created" | "updated"> {
  const DB = APPWRITE.databaseId
  const COL = APPWRITE.collections.leads
  const now = new Date().toISOString()
  const existing = await databases.listDocuments(DB, COL, [Query.equal("email", lead.email), Query.limit(1)])

  if (existing.documents.length > 0) {
    const doc = existing.documents[0]
    await databases.updateDocument(DB, COL, doc.$id, {
      first_name: doc.first_name || lead.first_name,
      last_name: doc.last_name || lead.last_name,
      company: doc.company || lead.company,
      job_title: doc.job_title || lead.job_title,
      updated_at: now,
    })
    return "updated"
  }

  await databases.createDocument(DB, COL, ID.unique(), {
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    company: lead.company,
    job_title: lead.job_title,
    source: sourceTag,
    status: "new",
    tags: ["researched"],
    created_at: now,
    updated_at: now,
  })
  return "created"
}

// A CSV can carry any columns at all; researching every row with a real
// browser is slow, so a single request researches at most this many.
const MAX_ROWS_PER_REQUEST = 20

export async function researchLeads(req: ResearchRequest, userEmail: string): Promise<ResearchOutcome> {
  const jobs: { knownInfo: string; startUrl?: string }[] = []

  if (req.mode === "describe") {
    const text = req.text.trim()
    if (!text) return { ok: false, created: 0, updated: 0, skipped: 0, leads: [], error: "Nothing to research yet." }
    jobs.push({
      knownInfo: text,
      startUrl: `https://www.google.com/search?q=${encodeURIComponent(text)}`,
    })
  } else {
    for (const row of req.rows.slice(0, MAX_ROWS_PER_REQUEST)) {
      const pairs = Object.entries(row)
        .filter(([, v]) => String(v ?? "").trim().length > 0)
        .map(([k, v]) => `${k}: ${v}`)
      if (pairs.length === 0) continue
      jobs.push({ knownInfo: pairs.join(", ") })
    }
  }

  if (jobs.length === 0) {
    return { ok: false, created: 0, updated: 0, skipped: 0, leads: [], error: "Nothing usable to research yet." }
  }

  const allLeads: ResearchedLead[] = []
  for (const job of jobs) {
    const found = await researchOne(job.knownInfo, job.startUrl)
    allLeads.push(...found)
  }

  // De-dupe within this batch before touching the database.
  const seen = new Set<string>()
  const unique = allLeads.filter((l) => (seen.has(l.email) ? false : (seen.add(l.email), true)))

  let created = 0
  let updated = 0
  const sourceTag = req.mode === "describe" ? "ai-research" : "ai-research-csv"
  for (const lead of unique) {
    try {
      const outcome = await persistLead(lead, sourceTag)
      if (outcome === "created") created++
      else updated++
    } catch {
      // best-effort; one bad write should not fail the whole batch
    }
  }

  await logActivity({
    category: "leads",
    action: "imported",
    title: "Lead research",
    description: `Researched ${jobs.length} lead${jobs.length === 1 ? "" : "s"}: ${created} created, ${updated} enriched.`,
    entityType: "leads",
    notify: true,
    metadata: { mode: req.mode, jobs: jobs.length, created, updated },
  }).catch(() => {})

  return {
    ok: true,
    created,
    updated,
    skipped: jobs.length - unique.length,
    leads: unique,
  }
}
