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

export type ActivityType = "research" | "prospects" | "sops" | "decisions" | "system" | "script" | "cold_email" | "automation" | "documents" | "notes" | "terminal" | "links" | "chat" | "ai_venture" | "todoist" | "knowledge" | "leads" | "vault" | "integrations" | "agents";
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

export type DashboardResponse = {
  kpis: KpiCard[];
  chart: ChartPoint[];
  activity: ActivityRow[];
  syncedAt: string;
  counts?: DashboardCounts;
  activityVolume?: VolumePoint[];
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

