import "server-only";
import { APPWRITE } from "@/lib/appwrite/config";
import { databases, ID } from "@/lib/appwrite/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ensureNotificationsCollection } from "@/lib/notifications/ensure";
import { ensureActivitiesCollection } from "@/lib/activities/ensure";
import { notifyViaNovu } from "@/lib/notifications/novu";

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

// Writes straight to Appwrite rather than fetching this app's own
// /api/activities/log endpoint. A self-fetch from inside another route
// handler doesn't carry the original request's session cookie, so
// getSessionUser() there always came back empty and the write silently
// 401'd. Every logActivity call across the app (links, vault, knowledge,
// boards, notes, ai-venture, terminal, todoist, leads, documents) was a
// no-op. Every caller already runs server-side, so a direct DB write is
// both correct and one fewer network hop.
export async function logActivity(entry: {
  category: ActivityCategory;
  action: ActivityAction;
  title: string;
  description: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, unknown>;
  // When true, also surfaces an in-app notification (only for meaningful
  // events, never used for noisy internal operations).
  notify?: boolean;
}): Promise<void> {
  try {
    const user = await getSessionUser();
    if (!user) return;
    await ensureActivitiesCollection();
    await databases.createDocument(APPWRITE.databaseId, APPWRITE.collections.activities, ID.unique(), {
      category: entry.category,
      action: entry.action,
      title: entry.title,
      description: entry.description ?? "",
      entity_id: entry.entityId ?? null,
      entity_type: entry.entityType ?? null,
      timestamp: new Date().toISOString(),
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      user_email: user.email ?? null,
    });

    if (entry.notify) {
      try {
        await ensureNotificationsCollection();
        await databases.createDocument(APPWRITE.databaseId, APPWRITE.collections.notifications, ID.unique(), {
          user_email: user.email ?? null,
          category: entry.category,
          title: entry.title,
          description: entry.description ?? "",
          entity_id: entry.entityId ?? null,
          entity_type: entry.entityType ?? null,
          read: false,
          created_at: new Date().toISOString(),
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        });
      } catch {
        // notifications are best-effort
      }
      // Mirror to Novu when configured (optional delivery channel).
      notifyViaNovu({
        subscriberId: user.email ?? "system",
        email: user.email ?? undefined,
        title: entry.title,
        body: entry.description ?? "",
      }).catch(() => {});
    }
  } catch (err) {
    console.error("[logActivity] failed:", err);
    // activity logging must never break the primary flow
  }
}
