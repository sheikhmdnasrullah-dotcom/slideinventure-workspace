import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { databases, Query, ID } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { ensureWorkSessionsCollection } from "@/lib/time-tracker/ensure";
import { logActivity } from "@/lib/activities/client";
import { publishEvent } from "@/lib/events/bus";
import type { WorkSession, WorkTimeSummary, LastSessionInfo } from "@/lib/time-tracker/types";
import { formatDurationHuman } from "@/lib/time-tracker/timer-store";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.workSessions ?? "work_sessions";

function formatTimeOnly(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function serializeSession(d: any): WorkSession {
  let metadata: Record<string, unknown> | undefined = undefined;
  if (d.metadata) {
    try {
      metadata = typeof d.metadata === "string" ? JSON.parse(d.metadata) : d.metadata;
    } catch {
      metadata = undefined;
    }
  }

  return {
    id: d.$id,
    userEmail: d.user_email,
    startTime: d.start_time,
    endTime: d.end_time,
    duration: Number(d.duration) || 0,
    date: d.date || d.start_time?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    project: d.project || "AI Venture",
    note: d.note || "",
    source: (d.source as WorkSession["source"]) || "manual_stopwatch",
    metadata,
    createdAt: d.created_at || d.$createdAt,
    updatedAt: d.updated_at || d.$updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 120, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  await ensureWorkSessionsCollection();

  try {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal("user_email", user.email ?? ""),
      Query.orderDesc("start_time"),
      Query.limit(100),
    ]);

    const sessions = res.documents.map(serializeSession);

    // Calculate time metrics based on local/current timestamps
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // Start of week (last 7 days window or current week)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let todayFocus = 0;
    let todaySessionsCount = 0;
    let weekFocus = 0;
    let weekSessionsCount = 0;
    let monthFocus = 0;
    let monthSessionsCount = 0;

    let lastSession: LastSessionInfo | null = null;

    if (sessions.length > 0) {
      const latest = sessions[0];
      const startFormatted = formatTimeOnly(latest.startTime);
      const endFormatted = formatTimeOnly(latest.endTime);
      lastSession = {
        id: latest.id,
        startTime: latest.startTime,
        endTime: latest.endTime,
        duration: latest.duration,
        project: latest.project,
        note: latest.note,
        formattedRange: `${startFormatted} – ${endFormatted}`,
      };
    }

    for (const session of sessions) {
      const sessionDate = new Date(session.startTime);
      const sessionDateStr = session.startTime?.slice(0, 10);

      if (sessionDateStr === todayStr) {
        todayFocus += session.duration;
        todaySessionsCount += 1;
      }

      if (sessionDate >= sevenDaysAgo) {
        weekFocus += session.duration;
        weekSessionsCount += 1;
      }

      if (sessionDate >= thirtyDaysAgo) {
        monthFocus += session.duration;
        monthSessionsCount += 1;
      }
    }

    // Also derive estimated active time from activity records today
    let estimatedActiveSeconds = todayFocus;
    try {
      const actRes = await databases.listDocuments(DB, APPWRITE.collections.activities, [
        Query.equal("user_email", user.email ?? ""),
        Query.greaterThanEqual("timestamp", `${todayStr}T00:00:00.000Z`),
        Query.orderAsc("timestamp"),
        Query.limit(200),
      ]);

      if (actRes.documents.length > 0) {
        // Group activity into active 5-minute work blocks (capped at realistic human bounds)
        let activeBlocks = 0;
        let lastTimestamp = 0;
        for (const doc of actRes.documents) {
          const t = new Date(doc.timestamp).getTime();
          if (t - lastTimestamp > 5 * 60 * 1000) {
            activeBlocks += 1;
          }
          lastTimestamp = t;
        }
        // Each active block is ~5 minutes of active workflow
        const estimatedFromEvents = activeBlocks * 5 * 60;
        estimatedActiveSeconds = Math.max(todayFocus, estimatedFromEvents);
      }
    } catch {
      // Graceful fallback
    }

    const summary: WorkTimeSummary = {
      today: {
        focusTimeSeconds: todayFocus,
        sessionsCount: todaySessionsCount,
        lastSession,
        estimatedActiveSeconds,
      },
      thisWeek: {
        focusTimeSeconds: weekFocus,
        sessionsCount: weekSessionsCount,
      },
      thisMonth: {
        focusTimeSeconds: monthFocus,
        sessionsCount: monthSessionsCount,
      },
      recentSessions: sessions.slice(0, 20),
    };

    return Response.json({
      sessions,
      summary,
    });
  } catch (error) {
    console.error("Error fetching work sessions:", error);
    return Response.json({
      sessions: [],
      summary: {
        today: { focusTimeSeconds: 0, sessionsCount: 0, lastSession: null, estimatedActiveSeconds: 0 },
        thisWeek: { focusTimeSeconds: 0, sessionsCount: 0 },
        thisMonth: { focusTimeSeconds: 0, sessionsCount: 0 },
        recentSessions: [],
      },
    });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  await ensureWorkSessionsCollection();

  const body = await request.json().catch(() => ({}));
  const { startTime, endTime, duration, project, note, source, metadata } = body;

  if (!startTime || !endTime || typeof duration !== "number" || duration <= 0) {
    return ApiError.badRequest("VALIDATION_ERROR", "Valid startTime, endTime, and duration are required").toResponse();
  }

  const date = startTime.slice(0, 10);
  const now = new Date().toISOString();
  const projectName = (project || "AI Venture").trim();
  const sessionNote = (note || "").trim();
  const sessionSource = source || "manual_stopwatch";

  try {
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      user_email: user.email,
      start_time: startTime,
      end_time: endTime,
      duration: Math.round(duration),
      date,
      project: projectName,
      note: sessionNote,
      source: sessionSource,
      metadata: metadata ? JSON.stringify(metadata) : null,
      created_at: now,
      updated_at: now,
    });

    const session = serializeSession(doc);
    const durationLabel = formatDurationHuman(session.duration);

    // Auto-log activity event
    await logActivity({
      category: "system",
      action: "completed",
      title: `Focus session: ${projectName} (${durationLabel})`,
      description: sessionNote || `Focused for ${durationLabel} on ${projectName}`,
      entityId: session.id,
      entityType: "work_session",
      metadata: {
        duration: session.duration,
        project: projectName,
        startTime,
        endTime,
      },
      userEmail: user.email,
    }).catch(() => {});

    // Broadcast domain event for immediate live UI refresh
    publishEvent({
      type: "work_session.completed" as any,
      source: "dashboard",
      title: `Work session completed: ${projectName}`,
      description: `${durationLabel} focused time`,
      entityId: session.id,
      entityType: "work_session",
      metadata: { duration: session.duration, project: projectName },
      userEmail: user.email,
    });

    return Response.json({ session }, { status: 201 });
  } catch (err) {
    console.error("Failed to save work session:", err);
    return ApiError.internal("DB_ERROR", "Failed to save work session").toResponse();
  }
}
