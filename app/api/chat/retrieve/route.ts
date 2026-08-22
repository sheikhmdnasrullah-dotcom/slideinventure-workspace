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

interface SourceGroup {
  source: string
  label: string
  results: RetrievalResult[]
  matchCount: number
}

const SECRET_PATTERNS = [
  /\b(password|secret|credential|api key|apikey|token|private key|vault)\b/i,
]

function isSecretQuery(message: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(message));
}

async function searchKnowledgeChunks(supabase: ReturnType<typeof createServiceClient>, query: string): Promise<RetrievalResult[]> {
  if (!query.trim()) return [];

  const { data, error } = await supabase.rpc("match_knowledge_chunks_fts", {
    query_text: query,
    match_count: 5,
  });

  if (error || !data) return [];

  return data.map((row: any) => ({
    source: "knowledge",
    title: row.heading || "Knowledge",
    snippet: row.text,
    path: `/knowledge/${row.knowledge_item_id}?chunk=${row.chunk_index}`,
    score: row.rank || 0,
  }));
}

async function searchLeads(supabase: ReturnType<typeof createServiceClient>, query: string): Promise<RetrievalResult[]> {
  if (!query.trim()) return [];

  const { data, error } = await supabase.rpc("search_leads_fts", {
    query_text: query,
    match_count: 10,
  });

  if (error || !data) return [];

  return data.map((row: any) => {
    const name = [row.first_name, row.last_name].filter(Boolean).join(" ") || "Unnamed";
    const snippet = [row.email, row.company, row.job_title, row.notes].filter(Boolean).join(" · ") || name;
    return {
      source: "leads",
      title: name,
      snippet,
      path: `/leads?id=${row.id}`,
      score: row.rank || 0,
    };
  });
}

async function searchTerminalCommands(supabase: ReturnType<typeof createServiceClient>, query: string): Promise<RetrievalResult[]> {
  if (!query.trim()) return [];

  const { data, error } = await supabase.rpc("search_terminal_commands_fts", {
    query_text: query,
    match_count: 10,
  });

  if (error || !data) return [];

  return data.map((row: any) => {
    const snippet = [row.command, row.stdout, row.stderr].filter(Boolean).join("\n") || row.command;
    return {
      source: "terminal",
      title: row.command,
      snippet: snippet.slice(0, 500),
      path: `/terminal?command=${encodeURIComponent(row.id)}`,
      score: row.rank || 0,
    };
  });
}

async function searchApps(supabase: ReturnType<typeof createServiceClient>, query: string): Promise<RetrievalResult[]> {
  if (!query.trim()) return [];

  const { data, error } = await supabase.rpc("search_apps_fts", {
    query_text: query,
    match_count: 10,
  });

  if (error || !data) return [];

  return data.map((row: any) => ({
    source: "apps",
    title: row.name,
    snippet: row.description || row.url || "",
    url: row.url,
    path: `/apps?id=${row.id}`,
    score: row.rank || 0,
  }));
}

async function searchUsefulLinks(supabase: ReturnType<typeof createServiceClient>, query: string): Promise<RetrievalResult[]> {
  if (!query.trim()) return [];

  const { data, error } = await supabase.rpc("search_useful_links_fts", {
    query_text: query,
    match_count: 10,
  });

  if (error || !data) return [];

  return data.map((row: any) => ({
    source: "links",
    title: row.title,
    snippet: row.description || row.url,
    url: row.url,
    path: `/useful-links?id=${row.id}`,
    score: row.rank || 0,
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

  const start = Date.now();
  const supabase = createServiceClient();

  const [knowledge, leads, terminal, apps, links] = await Promise.all([
    searchKnowledgeChunks(supabase, message),
    searchLeads(supabase, message),
    searchTerminalCommands(supabase, message),
    searchApps(supabase, message),
    searchUsefulLinks(supabase, message),
  ]);

  const sources: SourceGroup[] = [
    { source: "knowledge", label: "Knowledge base", results: knowledge, matchCount: knowledge.length },
    { source: "leads", label: "Leads", results: leads, matchCount: leads.length },
    { source: "terminal", label: "Terminal history", results: terminal, matchCount: terminal.length },
    { source: "apps", label: "Apps", results: apps, matchCount: apps.length },
    { source: "links", label: "Useful links", results: links, matchCount: links.length },
  ];

  const elapsed = Date.now() - start;

  return Response.json({
    type: "retrieval",
    query: message,
    elapsedMs: elapsed,
    sources,
  });
}
