import { APPWRITE } from "@/lib/appwrite/config";

export type Activity = import("./types").Activity;
export type ActivityCategory = import("./types").ActivityCategory;
export type ActivityAction = import("./types").ActivityAction;
export type ActivityListOptions = import("./types").ActivityListOptions;

function withQuery(params: Record<string, string | undefined>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") usp.set(k, v);
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

export async function listActivities(
  opts: ActivityListOptions = {}
): Promise<Activity[]> {
  const { category, limit = 40, cursor } = opts;
  const qs = withQuery({
    category,
    limit: String(limit),
    cursor,
  });

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/activities${qs}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json?.activities) ? json.activities : [];
}

export async function logActivity(entry: {
  category: ActivityCategory;
  action: ActivityAction;
  title: string;
  description: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/activities/log`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      }
    );
  } catch {
    // activity logging must never break the primary flow
  }
}
