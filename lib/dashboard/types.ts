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

export type ActivityType = "research" | "prospects" | "sops" | "decisions" | "system" | "script" | "cold_email" | "automation";
export type ActivityStatus = "ai_inferred" | "proposed" | "active" | "completed" | "failed" | "running";

export type ActivityRow = {
  id: string;
  item: string;
  type: ActivityType;
  status: ActivityStatus;
  source: string;
  updatedAt: string;
};

export type DashboardResponse = {
  kpis: KpiCard[];
  chart: ChartPoint[];
  activity: ActivityRow[];
  syncedAt: string;
};
