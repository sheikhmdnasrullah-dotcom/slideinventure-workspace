import { getSessionUser } from "@/lib/appwrite/auth";
import { databases, Query } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import type {
  DashboardResponse,
  ChartPoint,
  ActivityRow,
  KpiCard,
  ActivityStatus,
  DashboardCounts,
  VolumePoint,
  TodayMetrics,
  WhatChangedSummary,
  WhatChangedItem,
  ContinueItem,
  AttentionItem,
  NextBestAction,
  ActivityType,
} from "@/lib/dashboard/types";
import { ensureWorkSessionsCollection } from "@/lib/time-tracker/ensure";
import type { WorkSession, WorkTimeSummary, LastSessionInfo } from "@/lib/time-tracker/types";
import { formatDurationHuman } from "@/lib/time-tracker/timer-store";

const DB = APPWRITE.databaseId;
const RUNS = APPWRITE.collections.taskRuns;
const KI = APPWRITE.collections.knowledgeItems;
const LEADS = APPWRITE.collections.leads;
const DOCS = APPWRITE.collections.documents;
const NOTES = APPWRITE.collections.notes;
const BOARDS = APPWRITE.collections.boards;
const TERMINAL = APPWRITE.collections.terminalCommands;
const CHAT = APPWRITE.collections.chatSessions;
const ACTIVITIES = APPWRITE.collections.activities;
const RESEARCH_LAB = APPWRITE.collections.researchLabItems ?? "research_lab_items";
const WORK_SESSIONS = APPWRITE.collections.workSessions ?? "work_sessions";
const TODOIST = APPWRITE.collections.todoistTasks ?? "todoist_tasks";

function buildVolume(days: number, timestamps: string[]): VolumePoint[] {
  const points: VolumePoint[] = [];
  const today = new Date();
  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    if (!ts) continue;
    const key = new Date(ts).toISOString().slice(0, 10);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    points.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return points;
}

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

function mapActivityStatus(action: string | undefined): ActivityStatus {
  if (action === "failed") return "failed";
  if (action === "executed" || action === "messaged" || action === "running") return "active";
  if (action === "proposed") return "proposed";
  return "completed";
}

function formatTimeOnly(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24 && d.getDate() === now.getDate()) {
      return `Today · ${formatTimeOnly(iso)}`;
    }
    if (diffHours < 48) {
      return `Yesterday · ${formatTimeOnly(iso)}`;
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureWorkSessionsCollection();

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Parallel database reads for high performance
  const [
    kiRes,
    runsRes,
    leadsRes,
    docsRes,
    notesRes,
    boardsRes,
    terminalRes,
    chatRes,
    activitiesRes,
    researchRes,
    sessionsRes,
    todoistRes,
  ] = await Promise.all([
    databases.listDocuments(DB, KI, [Query.orderDesc("updated_at"), Query.limit(20)]).catch(() => ({ total: 0, documents: [] })),
    databases.listDocuments(DB, RUNS, [Query.orderDesc("started_at"), Query.limit(100)]).catch(() => ({ total: 0, documents: [] })),
    databases.listDocuments(DB, LEADS, [Query.orderDesc("created_at"), Query.limit(20)]).catch(() => ({ total: 0, documents: [] })),
    databases.listDocuments(DB, DOCS, [Query.orderDesc("created_at"), Query.limit(15)]).catch(() => ({ total: 0, documents: [] })),
    databases.listDocuments(DB, NOTES, [Query.equal("user_email", user.email ?? ""), Query.orderDesc("updated_at"), Query.limit(15)]).catch(() => ({ total: 0, documents: [] })),
    databases.listDocuments(DB, BOARDS, [Query.equal("user_email", user.email ?? ""), Query.orderDesc("updated_at"), Query.limit(15)]).catch(() => ({ total: 0, documents: [] })),
    databases.listDocuments(DB, TERMINAL, [Query.orderDesc("created_at"), Query.limit(10)]).catch(() => ({ total: 0, documents: [] })),
    databases.listDocuments(DB, CHAT, [Query.orderDesc("updated_at"), Query.limit(10)]).catch(() => ({ total: 0, documents: [] })),
    databases.listDocuments(DB, ACTIVITIES, [Query.equal("user_email", user.email ?? ""), Query.orderDesc("timestamp"), Query.limit(60)]).catch(() => ({ total: 0, documents: [] })),
    databases.listDocuments(DB, RESEARCH_LAB, [Query.equal("user_email", user.email ?? ""), Query.orderDesc("updated_at"), Query.limit(15)]).catch(() => ({ total: 0, documents: [] })),
    databases.listDocuments(DB, WORK_SESSIONS, [Query.equal("user_email", user.email ?? ""), Query.orderDesc("start_time"), Query.limit(60)]).catch(() => ({ total: 0, documents: [] })),
    databases.listDocuments(DB, TODOIST, [Query.limit(50)]).catch(() => ({ total: 0, documents: [] })),
  ]);

  const knowledgeItems = kiRes.documents;
  const taskRuns = runsRes.documents;
  const leads = leadsRes.documents;
  const recentDocs = docsRes.documents;
  const recentNotes = notesRes.documents;
  const recentBoards = boardsRes.documents;
  const recentTerminal = terminalRes.documents;
  const recentChatSessions = chatRes.documents;
  const recentActivities = activitiesRes.documents;
  const recentResearch = researchRes.documents;
  const rawWorkSessions = sessionsRes.documents;
  const todoistTasks = todoistRes.documents;

  // Work Sessions calculation
  const workSessions: WorkSession[] = rawWorkSessions.map((d: any) => ({
    id: d.$id,
    userEmail: d.user_email,
    startTime: d.start_time,
    endTime: d.end_time,
    duration: Number(d.duration) || 0,
    date: d.date || d.start_time?.slice(0, 10) || todayStr,
    project: d.project || "AI Venture",
    note: d.note || "",
    source: d.source || "manual_stopwatch",
    createdAt: d.created_at || d.$createdAt,
    updatedAt: d.updated_at || d.$updatedAt,
  }));

  let todayFocusSeconds = 0;
  let todaySessionsCount = 0;
  let weekFocusSeconds = 0;
  let weekSessionsCount = 0;
  let monthFocusSeconds = 0;
  let monthSessionsCount = 0;

  let lastSession: LastSessionInfo | null = null;
  if (workSessions.length > 0) {
    const latest = workSessions[0];
    lastSession = {
      id: latest.id,
      startTime: latest.startTime,
      endTime: latest.endTime,
      duration: latest.duration,
      project: latest.project,
      note: latest.note,
      formattedRange: `${formatTimeOnly(latest.startTime)} – ${formatTimeOnly(latest.endTime)}`,
    };
  }

  for (const s of workSessions) {
    const sDate = new Date(s.startTime);
    const sDateStr = s.startTime?.slice(0, 10);

    if (sDateStr === todayStr) {
      todayFocusSeconds += s.duration;
      todaySessionsCount += 1;
    }
    if (sDate >= sevenDaysAgo) {
      weekFocusSeconds += s.duration;
      weekSessionsCount += 1;
    }
    if (sDate >= thirtyDaysAgo) {
      monthFocusSeconds += s.duration;
      monthSessionsCount += 1;
    }
  }

  // Estimated Active Time
  const todayActivities = recentActivities.filter(
    (a: any) => a.timestamp?.slice(0, 10) === todayStr
  );
  let activeBlocks = 0;
  let lastActTime = 0;
  for (const a of todayActivities) {
    const t = new Date(a.timestamp).getTime();
    if (t - lastActTime > 5 * 60 * 1000) {
      activeBlocks += 1;
    }
    lastActTime = t;
  }
  const estimatedActiveSeconds = Math.max(todayFocusSeconds, activeBlocks * 5 * 60);

  const workTime: WorkTimeSummary = {
    today: {
      focusTimeSeconds: todayFocusSeconds,
      sessionsCount: todaySessionsCount,
      lastSession,
      estimatedActiveSeconds,
    },
    thisWeek: {
      focusTimeSeconds: weekFocusSeconds,
      sessionsCount: weekSessionsCount,
    },
    thisMonth: {
      focusTimeSeconds: monthFocusSeconds,
      sessionsCount: monthSessionsCount,
    },
    recentSessions: workSessions.slice(0, 15),
  };

  // Completed task runs
  const completedRuns = taskRuns.filter((r: any) => r.status === "completed");
  const failedRuns = taskRuns.filter((r: any) => r.status === "failed");

  // Today at a glance metrics
  const completedTasksToday = todayActivities.filter((a: any) =>
    a.action === "completed" || (a.category === "todoist" && a.action === "completed")
  ).length;

  const createdItemsToday = todayActivities.filter((a: any) =>
    a.action === "created" || a.action === "uploaded" || a.action === "imported"
  ).length;

  const researchUpdatesToday = todayActivities.filter((a: any) =>
    a.category === "knowledge" || a.category === "research" || a.entity_type === "research_item"
  ).length;

  const agentRunsToday = taskRuns.filter((r: any) =>
    (r.started_at ?? r.created_at)?.slice(0, 10) === todayStr
  ).length;

  const newLeadsToday = leads.filter((l: any) =>
    (l.created_at ?? l.$createdAt)?.slice(0, 10) === todayStr
  ).length;

  const notesCountToday = recentNotes.filter((n: any) =>
    (n.updated_at ?? n.created_at)?.slice(0, 10) === todayStr
  ).length;

  const todaySummary: TodayMetrics = {
    dateFormatted: now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    focusTimeSeconds: todayFocusSeconds,
    sessionsCount: todaySessionsCount,
    completedTasks: completedTasksToday,
    createdItems: createdItemsToday,
    researchUpdates: researchUpdatesToday,
    agentRuns: agentRunsToday,
    newLeads: newLeadsToday,
    notesCount: notesCountToday,
  };

  // What Changed Summary (Since last session or yesterday)
  const comparisonCutoff = lastSession
    ? new Date(lastSession.endTime).getTime()
    : new Date(now.getTime() - 24 * 60 * 60 * 1000).getTime();

  const sinceLabel = lastSession ? "Since your last session" : "Since yesterday";

  const notesDelta = recentNotes.filter((n: any) => new Date(n.created_at ?? n.updated_at).getTime() >= comparisonCutoff).length;
  const researchDelta = recentResearch.filter((r: any) => new Date(r.created_at ?? r.updated_at).getTime() >= comparisonCutoff).length;
  const leadsDelta = leads.filter((l: any) => new Date(l.created_at ?? l.$createdAt).getTime() >= comparisonCutoff).length;
  const runsDelta = taskRuns.filter((r: any) => new Date(r.started_at ?? r.created_at).getTime() >= comparisonCutoff).length;
  const boardsDelta = recentBoards.filter((b: any) => new Date(b.created_at ?? b.updated_at).getTime() >= comparisonCutoff).length;
  const tasksDelta = todayActivities.filter((a: any) => a.action === "completed" && new Date(a.timestamp).getTime() >= comparisonCutoff).length;

  const changeItems: WhatChangedItem[] = [];
  if (notesDelta > 0) changeItems.push({ label: `${notesDelta} note${notesDelta === 1 ? "" : "s"}`, count: notesDelta, href: "/notepad" });
  if (researchDelta > 0) changeItems.push({ label: `${researchDelta} research finding${researchDelta === 1 ? "" : "s"}`, count: researchDelta, href: "/research-lab" });
  if (leadsDelta > 0) changeItems.push({ label: `${leadsDelta} lead${leadsDelta === 1 ? "" : "s"}`, count: leadsDelta, href: "/leads" });
  if (runsDelta > 0) changeItems.push({ label: `${runsDelta} agent run${runsDelta === 1 ? "" : "s"}`, count: runsDelta, href: "/agents" });
  if (boardsDelta > 0) changeItems.push({ label: `${boardsDelta} brainstorm board${boardsDelta === 1 ? "" : "s"}`, count: boardsDelta, href: "/brainstorm-sketch" });
  if (tasksDelta > 0) changeItems.push({ label: `${tasksDelta} task${tasksDelta === 1 ? "" : "s"} completed`, count: tasksDelta, href: "/todoist" });

  const whatChanged: WhatChangedSummary = {
    sinceLabel,
    hasChanges: changeItems.length > 0,
    items: changeItems,
  };

  // Continue Where You Left Off (most recently updated real items)
  const continueItems: ContinueItem[] = [];

  if (recentResearch.length > 0) {
    const item = recentResearch[0];
    continueItems.push({
      id: item.$id,
      category: "research",
      title: item.title || "Untitled Research",
      sectionLabel: "Research Lab",
      lastOpenedLabel: `Research Lab · ${formatRelativeTime(item.updated_at ?? item.created_at)}`,
      href: "/research-lab",
      updatedAt: item.updated_at ?? item.created_at,
    });
  }

  if (recentBoards.length > 0) {
    const item = recentBoards[0];
    continueItems.push({
      id: item.$id,
      category: "brainstorm",
      title: item.title || "Brainstorm Board",
      sectionLabel: "Brainstorm",
      lastOpenedLabel: `Brainstorm · ${formatRelativeTime(item.updated_at ?? item.created_at)}`,
      href: "/brainstorm-sketch",
      updatedAt: item.updated_at ?? item.created_at,
    });
  }

  if (recentNotes.length > 0) {
    const item = recentNotes[0];
    continueItems.push({
      id: item.$id,
      category: "notes",
      title: item.title || "Untitled Note",
      sectionLabel: "Notepad",
      lastOpenedLabel: `Notepad · ${formatRelativeTime(item.updated_at ?? item.created_at)}`,
      href: `/notepad?id=${item.$id}`,
      updatedAt: item.updated_at ?? item.created_at,
    });
  }

  if (recentDocs.length > 0) {
    const item = recentDocs[0];
    continueItems.push({
      id: item.$id,
      category: "documents",
      title: item.title || item.filename || "Uploaded File",
      sectionLabel: "Documents",
      lastOpenedLabel: `Documents · ${formatRelativeTime(item.created_at ?? item.updated_at)}`,
      href: "/documents",
      updatedAt: item.created_at ?? item.updated_at,
    });
  }

  // What Needs Attention (ranked priority list)
  const needsAttention: AttentionItem[] = [];

  if (failedRuns.length > 0) {
    needsAttention.push({
      id: "failed-runs",
      severity: "high",
      title: `${failedRuns.length} failed task run${failedRuns.length === 1 ? "" : "s"}`,
      description: "Backend execution errors recorded in task log.",
      href: "/terminal",
      actionLabel: "Inspect Logs",
      category: "system",
    });
  }

  const openTasks = todoistTasks.filter((t: any) => !t.completed);
  const overdueTasks = openTasks.filter((t: any) => t.due_date && new Date(t.due_date).getTime() < now.getTime());
  if (overdueTasks.length > 0) {
    needsAttention.push({
      id: "overdue-tasks",
      severity: "high",
      title: `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}`,
      description: overdueTasks[0]?.content ? `"${overdueTasks[0].content}" is past due.` : "Tasks past their scheduled deadline.",
      href: "/todoist",
      actionLabel: "View Tasks",
      category: "todoist",
    });
  }

  if (recentDocs.length > 0 && recentResearch.length === 0) {
    needsAttention.push({
      id: "unsynthesized-docs",
      severity: "medium",
      title: "Document with no research entry",
      description: `"${recentDocs[0].title || recentDocs[0].filename}" was uploaded ${formatRelativeTime(recentDocs[0].created_at ?? recentDocs[0].updated_at)}.`,
      href: "/documents",
      actionLabel: "Open",
      category: "documents",
    });
  }

  // Next up: each entry names a specific item and states the fact that surfaced
  // it. No encouragement, no invented priorities — if there is no concrete open
  // loop in the data, this list stays empty.
  const nextBestActions: NextBestAction[] = [];

  if (recentDocs.length > 0) {
    const doc = recentDocs[0];
    nextBestActions.push({
      id: "next-analyze-doc",
      title: `Synthesize "${doc.title || doc.filename || "recent document"}"`,
      reason: `Uploaded ${formatRelativeTime(doc.created_at ?? doc.updated_at)}, no research entry references it.`,
      actionLabel: "Open document",
      href: "/documents",
      category: "documents",
      priority: "high",
    });
  }

  if (recentResearch.length > 0) {
    const resItem = recentResearch[0];
    nextBestActions.push({
      id: "next-continue-research",
      title: `Continue "${resItem.title}"`,
      reason: `Last edited ${formatRelativeTime(resItem.updated_at ?? resItem.created_at)}.`,
      actionLabel: "Open Research Lab",
      href: "/research-lab",
      category: "research",
      priority: "high",
    });
  }

  if (openTasks.length > 0) {
    nextBestActions.push({
      id: "next-open-task",
      title: openTasks[0].content || "Open task",
      reason: `${openTasks.length} task${openTasks.length === 1 ? "" : "s"} still open.`,
      actionLabel: "Open Todoist",
      href: "/todoist",
      category: "todoist",
      priority: "medium",
    });
  }

  // Recent consolidated activity rows
  const activity: ActivityRow[] = recentActivities.map((d: any) => ({
    id: d.$id,
    item: d.title || "Untitled",
    type: (d.category as ActivityType) ?? "system",
    status: mapActivityStatus(d.action),
    source: d.entity_type || d.category || "workspace",
    category: d.category,
    entityId: d.entity_id ?? undefined,
    entityType: d.entity_type ?? undefined,
    description: d.description ?? "",
    updatedAt: d.timestamp ?? now.toISOString(),
  }));

  const counts: DashboardCounts = {
    notes: notesRes.total ?? recentNotes.length,
    documents: docsRes.total ?? recentDocs.length,
    knowledge: kiRes.total ?? knowledgeItems.length,
    leads: leadsRes.total ?? leads.length,
    boards: boardsRes.total ?? recentBoards.length,
    agentRuns: runsRes.total ?? taskRuns.length,
    activities7d: recentActivities.length,
  };

  const activityVolume = buildVolume(14, recentActivities.map((d: any) => d.timestamp));

  const kpis: KpiCard[] = [
    {
      id: "focus-time-today",
      label: "Focused Time Today",
      value: formatDurationHuman(todayFocusSeconds),
      trend: { direction: todayFocusSeconds > 0 ? "up" : "flat", label: `${todaySessionsCount} sessions` },
      context: "Authoritative manual stopwatch time",
      subline: lastSession ? `Last: ${lastSession.formattedRange}` : "No sessions today yet",
    },
    {
      id: "active-leads",
      label: "Active Leads",
      value: String(counts.leads),
      trend: { direction: counts.leads > 0 ? "up" : "flat", label: `${newLeadsToday} added today` },
      context: "Leads in workspace pipeline",
      subline: "Live from leads database",
    },
    {
      id: "research-items",
      label: "Research Items",
      value: String(recentResearch.length),
      trend: { direction: recentResearch.length > 0 ? "up" : "flat", label: `${researchUpdatesToday} today` },
      context: "Active research findings",
      subline: "Live from Research Lab",
    },
    {
      id: "task-runs",
      label: "Task Runs",
      value: String(counts.agentRuns),
      trend: { direction: "flat", label: `${completedRuns.length} done, ${failedRuns.length} failed` },
      context: "Total backend executions",
      subline: "Live from task runner",
    },
    {
      id: "documents",
      label: "Documents",
      value: String(counts.documents),
      trend: { direction: counts.documents > 0 ? "up" : "flat", label: "total files" },
      context: "Uploaded workspace assets",
      subline: "Live from documents",
    },
    {
      id: "notes",
      label: "Notes",
      value: String(counts.notes),
      trend: { direction: counts.notes > 0 ? "up" : "flat", label: "total notes" },
      context: "Captured ideas and notes",
      subline: "Live from notepad",
    },
  ];

  const response: DashboardResponse = {
    kpis,
    chart: buildChart(90, taskRuns),
    activity,
    syncedAt: new Date().toISOString(),
    counts,
    activityVolume,
    workTime,
    todaySummary,
    whatChanged,
    continueItems,
    needsAttention,
    nextBestActions,
  };

  return Response.json(response);
}
