import type { WorkTimeSummary } from "@/lib/time-tracker/types";

export type TrendDirection = "up" | "down" | "flat";

export type KpiCard = {
  id: string;
  label: string;
  value: string;
  trend: {
    direction: TrendDirection;
    label: string;
  };
  context: string;
  subline: string;
};

export type ChartPoint = {
  date: string;
  sent: number;
  replies: number;
};

export type ActivityType =
  | "research"
  | "prospects"
  | "sops"
  | "decisions"
  | "system"
  | "script"
  | "cold_email"
  | "automation"
  | "documents"
  | "notes"
  | "terminal"
  | "links"
  | "chat"
  | "ai_venture"
  | "todoist"
  | "knowledge"
  | "leads"
  | "vault"
  | "integrations"
  | "agents"
  | "ideas"
  | "brainstorm";

export type ActivityStatus = "ai_inferred" | "proposed" | "active" | "completed" | "failed" | "running";

export type ActivityRow = {
  id: string;
  item: string;
  type: ActivityType;
  status: ActivityStatus;
  source: string;
  updatedAt: string;
  category?: string;
  entityId?: string;
  entityType?: string;
  description?: string;
  href?: string;
};

export type DashboardCounts = {
  notes: number;
  documents: number;
  knowledge: number;
  leads: number;
  boards: number;
  agentRuns: number;
  activities7d: number;
};

export type VolumePoint = {
  date: string;
  count: number;
};

export type TodayMetrics = {
  dateFormatted: string; // e.g. "Saturday · August 29"
  focusTimeSeconds: number;
  sessionsCount: number;
  completedTasks: number;
  createdItems: number;
  researchUpdates: number;
  agentRuns: number;
  newLeads: number;
  notesCount: number;
};

export type WhatChangedItem = {
  label: string;
  count: number;
  href: string;
};

export type WhatChangedSummary = {
  sinceLabel: string; // e.g. "Since yesterday" or "Since your last session"
  hasChanges: boolean;
  items: WhatChangedItem[];
};

export type ContinueItem = {
  id: string;
  category: string; // "research" | "brainstorm" | "notes" | "documents" | "concepts" | "leads"
  title: string;
  sectionLabel: string;
  lastOpenedLabel: string; // e.g. "Research Lab · 1:42 AM"
  href: string;
  updatedAt: string;
};

export type AttentionSeverity = "high" | "medium" | "low" | "good";

export type AttentionItem = {
  id: string;
  severity: AttentionSeverity;
  title: string;
  description: string;
  href: string;
  actionLabel?: string;
  category: string;
};

export type NextBestAction = {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  href: string;
  category: string;
  priority: "high" | "medium";
};

export type ContextMessageInfo = {
  headline: string;
  subtext: string;
  badge?: string;
  tone: "focus" | "momentum" | "caution" | "action";
};

export type DashboardResponse = {
  kpis: KpiCard[];
  chart: ChartPoint[];
  activity: ActivityRow[];
  syncedAt: string;
  counts?: DashboardCounts;
  activityVolume?: VolumePoint[];
  workTime?: WorkTimeSummary;
  todaySummary?: TodayMetrics;
  whatChanged?: WhatChangedSummary;
  continueItems?: ContinueItem[];
  needsAttention?: AttentionItem[];
  nextBestActions?: NextBestAction[];
  contextMessage?: ContextMessageInfo;
};

export type DashboardWidget =
  | "kpis"
  | "chart"
  | "activity"
  | "research"
  | "ai_venture"
  | "brainstorm"
  | "terminal"
  | "leads"
  | "knowledge"
  | "suggestions"
  | "documents"
  | "notes"
  | "chat"
  | "todoist"
  | "links";

export type DashboardWidgetProps = {
  title: string;
  description?: string;
  href?: string;
  count?: number;
  emptyText?: string;
};
