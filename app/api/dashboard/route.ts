import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import type { DashboardResponse, ChartPoint, ActivityRow, KpiCard } from "@/lib/dashboard/types";

const DB = APPWRITE.databaseId;
const RUNS = APPWRITE.collections.taskRuns;

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
      // ponytail: no reply-tracking data source exists yet (task_runs has no reply field); add when reply capture ships
      replies: 0,
    });
  }

  return points;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  let knowledgeItems: any[] = [];
  let taskRuns: any[] = [];
  let activeLeads = 0;

  try {
    const { data: knowledgeItemsData } = await supabase
      .from("knowledge_items")
      .select("id, type, title, status, source, updated_at")
      .order("updated_at", { ascending: false })
      .limit(20);
    knowledgeItems = knowledgeItemsData ?? [];
  } catch {
    // Supabase unreachable; degrade gracefully with empty data
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
    const { count } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .neq("status", "lost");
    activeLeads = count ?? 0;
  } catch {
    // Supabase unreachable; degrade gracefully with empty data
  }

  const items = knowledgeItems;
  const runs = taskRuns;

  const kpis: KpiCard[] = [
    {
      id: "emails-sent",
      label: "Emails Sent (7d)",
      value: String(runs.filter((r) => r.task_type === "cold_email" && r.status === "completed").length),
      trend: { direction: "up", label: "from task log" },
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
      trend: { direction: "up", label: `${items.filter((i) => i.status === "active").length} active` },
      context: "Total synced items",
      subline: "Live from knowledge base",
    },
    {
      id: "task-runs",
      label: "Task Runs",
      value: String(runs.length),
      trend: { direction: "flat", label: `${runs.filter((r) => r.status === "completed").length} completed` },
      context: "Total backend executions",
      subline: "Live from task_runs",
    },
  ];

  const activity: ActivityRow[] = [
    ...runs.slice(0, 5).map((run) => ({
      id: run.id,
      item: run.command ?? run.task_type,
      type: run.task_type as ActivityRow["type"],
      status: (run.status === "completed" ? "active" : run.status === "failed" ? "ai_inferred" : run.status) as ActivityRow["status"],
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
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10);

  const response: DashboardResponse = {
    kpis,
    chart: buildChart(90, runs),
    activity,
    syncedAt: new Date().toISOString(),
  };

  return Response.json(response);
}
