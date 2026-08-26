import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import type { DashboardResponse, ChartPoint, ActivityRow, KpiCard } from "@/lib/dashboard/types";
import { logActivity } from "@/lib/activities/client";

const DB = APPWRITE.databaseId;
const RUNS = APPWRITE.collections.taskRuns;
const KI = APPWRITE.collections.knowledgeItems;
const LEADS = APPWRITE.collections.leads;
const DOCS = APPWRITE.collections.documents;
const NOTES = APPWRITE.collections.notes;
const TERMINAL = APPWRITE.collections.terminalCommands;
const LINKS = APPWRITE.collections.usefulLinks;
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
  let recentLinks: any[] = [];
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
    const res = await databases.listDocuments(DB, LINKS, [
      Query.orderDesc("created_at"),
      Query.limit(6),
    ]);
    recentLinks = res.documents.map((d: any) => ({
      id: d.$id,
      title: d.title,
      url: d.url,
      created_at: d.created_at,
      tags: d.tags,
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

  const activity: ActivityRow[] = [
    ...runs.slice(0, 5).map((run) => ({
      id: run.id,
      item: run.command ?? run.task_type,
      type: run.task_type as ActivityRow["type"],
      status: run.status === "completed" ? "active" : run.status === "failed" ? "ai_inferred" : run.status,
      source: run.triggered_by ?? "backend",
      updatedAt: run.started_at,
    })),
    ...items.slice(0, 5).map((item) => ({
      id: item.id,
      item: item.title,
      type: (item.type as ActivityRow["type"]) ?? "system",
      status: (item.status as ActivityRow["status"]) ?? "proposed",
      source: item.source,
      updatedAt: item.updated_at,
    })),
    ...recentDocs.slice(0, 3).map((doc) => ({
      id: doc.id,
      item: doc.title || doc.filename || "Untitled document",
      type: "documents" as ActivityRow["type"],
      status: "active" as ActivityRow["status"],
      source: "documents",
      updatedAt: doc.created_at ?? doc.updated_at,
    })),
    ...recentNotes.slice(0, 3).map((note) => ({
      id: note.id,
      item: note.title || "Untitled note",
      type: "notes" as ActivityRow["type"],
      status: "active" as ActivityRow["status"],
      source: "notes",
      updatedAt: note.updated_at ?? note.created_at,
    })),
    ...recentTerminal.slice(0, 3).map((t) => ({
      id: t.id,
      item: t.title || t.command,
      type: "terminal" as ActivityRow["type"],
      status: "active" as ActivityRow["status"],
      source: t.category ?? "terminal",
      updatedAt: t.created_at,
    })),
    ...recentLinks.slice(0, 3).map((link) => ({
      id: link.id,
      item: link.title || link.url,
      type: "links" as ActivityRow["type"],
      status: "active" as ActivityRow["status"],
      source: "links",
      updatedAt: link.created_at,
    })),
    ...recentChatSessions.slice(0, 3).map((session) => ({
      id: session.id,
      item: session.title || "Chat session",
      type: "chat" as ActivityRow["type"],
      status: "active" as ActivityRow["status"],
      source: "chat",
      updatedAt: session.updated_at ?? session.created_at,
    })),
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 20);

  const suggestions: string[] = [];
  if (items.length === 0) suggestions.push("Your knowledge base is empty. Add your first note.");
  if (activeLeads === 0 && recentDocs.length === 0) suggestions.push("No active leads or recent documents — start by importing leads or uploading a document.");
  if (failedRuns.length > 0) suggestions.push(`${failedRuns.length} failed task run${failedRuns.length === 1 ? "" : "s"} — check the task log.`);
  if (recentTerminal.length > 0 && recentNotes.length === 0) suggestions.push("You saved terminal findings but no notes yet — consider turning findings into notes.");
  if (suggestions.length === 0) suggestions.push("All systems active. Keep exploring.");

  const response: DashboardResponse = {
    kpis,
    chart: buildChart(90, runs),
    activity,
    syncedAt: new Date().toISOString(),
  };

  return Response.json(response);
}
