import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { NextRequest } from "next/server";

interface RetrievalResult {
  source: string
  title: string
  snippet: string
  path?: string
  url?: string
  score: number
}

const RETRIEVAL_PATTERNS = [
  /\b(get me|find me|pull up|what'?s the .+ for|show me the .+ about|look up|search for|find)\b/i,
  /\b(lead|contact|person|people|user|customer|client)\b/i,
  /\b(command|terminal|history|script)\b/i,
  /\b(knowledge|doc|document|note|article|guide|sop)\b/i,
  /\b(app|integration|tool|service|link)\b/i,
]

const SECRET_PATTERNS = [
  /\b(password|secret|credential|api key|apikey|token|private key|vault)\b/i,
]

function isRetrievalQuery(message: string): boolean {
  return RETRIEVAL_PATTERNS.some((pattern) => pattern.test(message));
}

function isSecretQuery(message: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(message));
}

async function searchKnowledgeChunks(supabase: ReturnType<typeof createServiceClient>, query: string): Promise<RetrievalResult[]> {
  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: null,
    match_count: 5,
    filter_item_ids: null,
  });

  if (error || !data) return [];

  return data.map((row: any) => ({
    source: "knowledge",
    title: row.heading || "Knowledge",
    snippet: row.text,
    path: `/knowledge/${row.knowledge_item_id}?chunk=${row.chunk_index}`,
    score: row.similarity || 0,
  }));
}

async function searchLeads(supabase: ReturnType<typeof createServiceClient>, query: string): Promise<RetrievalResult[]> {
  const q = query.toLowerCase();
  const { data, error } = await supabase
    .from("leads")
    .select("id, first_name, last_name, email, company, job_title, notes, tags")
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%,job_title.ilike.%${query}%,notes.ilike.%${query}%`)
    .limit(10);

  if (error || !data) return [];

  return data.map((lead: any) => {
    const name = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Unnamed";
    const snippet = [lead.email, lead.company, lead.job_title, lead.notes].filter(Boolean).join(" · ") || name;
    return {
      source: "leads",
      title: name,
      snippet,
      path: `/leads?id=${lead.id}`,
      score: 0.8,
    };
  });
}

async function searchTerminalCommands(supabase: ReturnType<typeof createServiceClient>, query: string): Promise<RetrievalResult[]> {
  const { data, error } = await supabase
    .from("terminal_commands")
    .select("id, command, cwd, exit_code, stdout, stderr, created_at")
    .or(`command.ilike.%${query}%,stdout.ilike.%${query}%,stderr.ilike.%${query}%`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error || !data) return [];

  return data.map((cmd: any) => {
    const snippet = [cmd.command, cmd.stdout, cmd.stderr].filter(Boolean).join("\n") || cmd.command;
    return {
      source: "terminal",
      title: cmd.command,
      snippet: snippet.slice(0, 300),
      path: `/terminal?command=${encodeURIComponent(cmd.id)}`,
      score: 0.7,
    };
  });
}

async function searchApps(supabase: ReturnType<typeof createServiceClient>, query: string): Promise<RetrievalResult[]> {
  const { data, error } = await supabase
    .from("apps")
    .select("id, name, description, url, category")
    .or(`name.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
    .limit(10);

  if (error || !data) return [];

  return data.map((app: any) => ({
    source: "apps",
    title: app.name,
    snippet: app.description || app.url || "",
    url: app.url,
    path: `/apps?id=${app.id}`,
    score: 0.6,
  }));
}

async function searchUsefulLinks(supabase: ReturnType<typeof createServiceClient>, query: string): Promise<RetrievalResult[]> {
  const { data, error } = await supabase
    .from("useful_links")
    .select("id, title, url, description, tags")
    .or(`title.ilike.%${query}%,description.ilike.%${query}%,url.ilike.%${query}%`)
    .limit(10);

  if (error || !data) return [];

  return data.map((link: any) => ({
    source: "links",
    title: link.title,
    snippet: link.description || link.url,
    url: link.url,
    path: `/useful-links?id=${link.id}`,
    score: 0.5,
  }));
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const message = (body.message as string | undefined)?.trim();
  if (!message) {
    return Response.json({ error: "Message required" }, { status: 400 });
  }

  if (isSecretQuery(message)) {
    return Response.json({ type: "secret_query", message: "Secret queries require step-up authentication." }, { status: 403 });
  }

  if (!isRetrievalQuery(message)) {
    return Response.json({ type: "not_retrieval" });
  }

  const supabase = createServiceClient();

  const [knowledge, leads, terminal, apps, links] = await Promise.all([
    searchKnowledgeChunks(supabase, message),
    searchLeads(supabase, message),
    searchTerminalCommands(supabase, message),
    searchApps(supabase, message),
    searchUsefulLinks(supabase, message),
  ]);

  const allResults = [...knowledge, ...leads, ...terminal, ...apps, ...links];
  allResults.sort((a, b) => b.score - a.score);

  const topResults = allResults.slice(0, 5);

  return Response.json({
    type: "retrieval",
    query: message,
    results: topResults,
  });
}
