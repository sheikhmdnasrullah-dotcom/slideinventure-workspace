import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import type { DashboardResponse, ChartPoint, ActivityRow, KpiCard, ActivityStatus } from "@/lib/dashboard/types";
import { logActivity } from "@/lib/activities/client";

const DB = APPWRITE.databaseId;
const RUNS = APPWRITE.collections.taskRuns;
const KI = APPWRITE.collections.knowledgeItems;
const LEADS = APPWRITE.collections.leads;
const DOCS = APPWRITE.collections.documents;
const NOTES = APPWRITE.collections.notes;
const TERMINAL = APPWRITE.collections.terminalCommands;
const CHAT = APPWRITE.collections.chatSessions;
const AI_VENTURE = "ai_venture_files";

function buildChart(days: number, runs: any[]): ChartPoint[] {
  const points: ChartPoint[] = [];
  const today = new Date();

  const sentByDate = new Map<string, number>();
  for (const run of runs) {
    if (run.task_type !== "cold_email" || run.status !== "completed") continue;
    const date = (run.completed_at ?? run.started_at)?.slice(0, 10);
    if (!date) continue;
    sentByDate.set(date, (sentByDate.get(date) ?? 0) + 1);
  }

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const key = date.toISOString().slice(0, 10);
    points.push({
      date: key,
      sent: sentByDate.get(key) ?? 0,
      replies: 0,
    });
  }

  return points;
}

function humanize(value: string | undefined | null, fallback = "System") {
  if (!value) return fallback;
  const cleaned = value.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return cleaned || fallback;
}

function mapActivityStatus(action: string | undefined): ActivityStatus {
  if (action === "failed") return "failed";
  if (action === "executed" || action === "messaged") return "active";
  if (action === "proposed") return "proposed";
  return "completed";
}

function activityFromDoc(d: any, category: string, action: string, title: string, description?: string): ActivityRow {
  return {
    id: d.$id,
    item: title,
    type: category as ActivityRow["type"],
    status: (d.status === "completed" || d.status === "active") ? "active" : d.status === "failed" ? "ai_inferred" : "proposed",
    source: d.source ?? d.triggered_by ?? d.created_by ?? "workspace",
    updatedAt: d.updated_at ?? d.created_at ?? new Date().toISOString(),
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let knowledgeItems: any[] = [];
  let taskRuns: any[] = [];
  let activeLeads = 0;
  let recentDocs: any[] = [];
  let recentNotes: any[] = [];
  let recentTerminal: any[] = [];
  let recentChatSessions: any[] = [];

  try {
    const res = await databases.listDocuments(DB, KI, [
      Query.orderDesc("updated_at"),
      Query.limit(20),
    ]);
    knowledgeItems = res.documents.map((d: any) => ({
      id: d.$id,
      type: d.type,
      title: d.title,
      status: d.status,
      source: d.source,
      updated_at: d.updated_at,
      category: d.category,
    }));
  } catch {
    // Appwrite unreachable; degrade gracefully with empty data
  }

  try {
    const res = await databases.listDocuments(DB, RUNS, [
      Query.orderDesc("started_at"),
      Query.limit(100),
    ]);
    taskRuns = res.documents.map((d: any) => ({
      id: d.$id,
      task_type: d.task_type,
      status: d.status,
      command: d.command,
      exit_code: d.exit_code,
      started_at: d.started_at,
      completed_at: d.completed_at,
      triggered_by: d.triggered_by,
    }));
  } catch {
    // Appwrite unreachable; degrade gracefully with empty data
  }

  try {
    const res = await databases.listDocuments(DB, LEADS, [
      Query.notEqual("status", "lost"),
      Query.limit(1),
    ]);
    activeLeads = res.total;
  } catch {
    // Appwrite unreachable; degrade gracefully with empty data
  }

  try {
    const res = await databases.listDocuments(DB, DOCS, [
      Query.orderDesc("created_at"),
      Query.limit(8),
    ]);
    recentDocs = res.documents.map((d: any) => ({
      id: d.$id,
      title: d.title,
      filename: d.filename,
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));
  } catch {
    // Appwrite unreachable; degrade gracefully with empty data
  }

  try {
    const res = await databases.listDocuments(DB, NOTES, [
      Query.orderDesc("updated_at"),
      Query.limit(8),
    ]);
    recentNotes = res.documents.map((d: any) => ({
      id: d.$id,
      title: d.title,
      updated_at: d.updated_at,
      created_at: d.created_at,
    }));
  } catch {
    // Appwrite unreachable; degrade gracefully with empty data
  }

  try {
    const res = await databases.listDocuments(DB, TERMINAL, [
      Query.orderDesc("created_at"),
      Query.limit(6),
    ]);
    recentTerminal = res.documents.map((d: any) => ({
      id: d.$id,
      title: d.title,
      command: d.command,
      description: d.description,
      created_at: d.created_at,
      category: d.category,
    }));
  } catch {
    // Appwrite unreachable; degrade gracefully with empty data
  }

  try {
    const res = await databases.listDocuments(DB, CHAT, [
      Query.orderDesc("updated_at"),
      Query.limit(6),
    ]);
    recentChatSessions = res.documents.map((d: any) => ({
      id: d.$id,
      title: d.title,
      updated_at: d.updated_at,
      created_at: d.created_at,
    }));
  } catch {
    // Appwrite unreachable; degrade gracefully with empty data
  }

  const items = knowledgeItems;
  const runs = taskRuns;

  const completedRuns = runs.filter((r) => r.status === "completed");
  const failedRuns = runs.filter((r) => r.status === "failed");

  const kpis: KpiCard[] = [
    {
      id: "emails-sent",
      label: "Emails Sent (7d)",
      value: String(completedRuns.filter((r) => r.task_type === "cold_email").length),
      trend: { direction: completedRuns.length > 0 ? "up" : "flat", label: "from task log" },
      context: "Counts cold_email runs with exit_code 0",
      subline: "Live from task_runs",
    },
    {
      id: "active-prospects",
      label: "Active Leads",
      value: String(activeLeads),
      trend: { direction: "flat", label: "from leads table" },
      context: "Active leads in the leads table",
      subline: "Live from leads",
    },
    {
      id: "knowledge-items",
      label: "Knowledge Items",
      value: String(items.length),
      trend: { direction: items.length > 0 ? "up" : "flat", label: `${items.filter((i) => i.status === "active").length} active` },
      context: "Total synced items",
      subline: "Live from knowledge base",
    },
    {
      id: "task-runs",
      label: "Task Runs",
      value: String(runs.length),
      trend: { direction: "flat", label: `${completedRuns.length} completed, ${failedRuns.length} failed` },
      context: "Total backend executions",
      subline: "Live from task_runs",
    },
    {
      id: "recent-documents",
      label: "Documents",
      value: String(recentDocs.length),
      trend: { direction: recentDocs.length > 0 ? "up" : "flat", label: "recent uploads" },
      context: "Recently uploaded files",
      subline: "Live from documents",
    },
    {
      id: "recent-notes",
      label: "Notes",
      value: String(recentNotes.length),
      trend: { direction: recentNotes.length > 0 ? "up" : "flat", label: "recent edits" },
      context: "Recently edited notes",
      subline: "Live from notes",
    },
  ];

  // Unified, real, auto-updating activity from every module that logs via
  // logActivity (documents, links, knowledge, boards, notes, ai-venture,
  // terminal, todoist, leads, vault, ...). Queried directly (not through the
  // self-fetch helper) so it runs in-request with the user's session cookie.
  let recentActivities: any[] = [];
  try {
    const res = await databases.listDocuments(DB, APPWRITE.collections.activities, [
      Query.equal("user_email", user.email ?? ""),
      Query.orderDesc("timestamp"),
      Query.limit(30),
    ]);
    recentActivities = res.documents;
  } catch {
    // Appwrite unreachable; degrade gracefully with empty data
  }

  const activity: ActivityRow[] = [
    ...recentActivities.map((d: any) => ({
      id: d.$id,
      item: d.title || "Untitled",
      type: (d.category as ActivityRow["type"]) ?? "system",
      status: mapActivityStatus(d.action),
      source: d.entity_type || d.category || "workspace",
      updatedAt: d.timestamp ?? new Date().toISOString(),
    })),
    // Chat isn't yet wired into logActivity; keep recent sessions so the
    // Chat card stays populated with real data.
    ...recentChatSessions.slice(0, 3).map((session) => ({
      id: session.id,
      item: session.title || "Chat session",
      type: "chat" as ActivityRow["type"],
      status: "active" as ActivityRow["status"],
      source: "chat",
      updatedAt: session.updated_at ?? session.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 30);

  const suggestions: string[] = [];
  if (items.length === 0) suggestions.push("Your knowledge base is empty. Add your first note.");
  if (activeLeads === 0 && recentDocs.length === 0) suggestions.push("No active leads or recent documents. Start by importing leads or uploading a document.");
  if (failedRuns.length > 0) suggestions.push(`${failedRuns.length} failed task run${failedRuns.length === 1 ? "" : "s"}. Check the task log.`);
  if (recentTerminal.length > 0 && recentNotes.length === 0) suggestions.push("You saved terminal findings but no notes yet. Consider turning findings into notes.");
  if (suggestions.length === 0) suggestions.push("All systems active. Keep exploring.");

  const response: DashboardResponse = {
    kpis,
    chart: buildChart(90, runs),
    activity,
    syncedAt: new Date().toISOString(),
  };

  return Response.json(response);
}
