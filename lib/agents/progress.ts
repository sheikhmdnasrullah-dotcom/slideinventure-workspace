/**
 * Progress reporting utilities for agent runners.
 * Writes progress events to task_run_events for live "43/100" UX.
 */

import { Client, Databases, ID, Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { ProgressPayload, TaskRunMetadata } from "./registry";

// Self-contained Appwrite client (service role). Imported by both the Next.js
// server runtime and the standalone `scripts/agent.ts` Node script, so it
// intentionally constructs its own client instead of the "server-only" wrapper.
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1")
  .setProject(process.env.APPWRITE_PROJECT_ID || "6a8cf7090015800700cc")
  .setKey(process.env.APPWRITE_API_KEY || "dummy-build-key");

const databases = new Databases(client);

const DB = APPWRITE.databaseId;
const RUNS = APPWRITE.collections.taskRuns;
const EVENTS = APPWRITE.collections.taskRunEvents;

function parseJson(v: unknown): Record<string, unknown> {
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return {}; }
  }
  return (v as Record<string, unknown>) ?? {};
}

/**
 * Report progress for a task run. Writes to task_run_events with
 * monotonically increasing sequence numbers.
 */
export async function reportProgress(
  _supabase: unknown,
  taskRunId: string,
  progress: ProgressPayload
): Promise<void> {
  try {
    const res = await databases.listDocuments(DB, EVENTS, [
      Query.equal("task_run_id", taskRunId),
      Query.orderDesc("sequence"),
      Query.limit(1),
    ]);

    const latest = res.documents[0];
    const sequence = (latest?.sequence ?? 0) + 1;

    await databases.createDocument(DB, EVENTS, ID.unique(), {
      task_run_id: taskRunId,
      sequence,
      current: progress.current,
      total: progress.total,
      current_item: progress.currentItem ?? null,
      status: progress.status ?? "running",
      metadata: JSON.stringify(progress.metadata ?? {}),
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Progress report failed:", error);
  }
}

/**
 * Complete a task run with final status.
 */
export async function completeTaskRun(
  _supabase: unknown,
  taskRunId: string,
  status: "completed" | "failed",
  output: string,
  exitCode: number,
  metadata?: TaskRunMetadata
): Promise<void> {
  try {
    await databases.updateDocument(DB, RUNS, taskRunId, {
      status,
      output,
      exit_code: exitCode,
      completed_at: new Date().toISOString(),
      metadata: JSON.stringify(metadata ?? {}),
    });
  } catch (error) {
    console.error("Task completion update failed:", error);
  }

  // Also emit final progress event
  await reportProgress(_supabase, taskRunId, {
    current: 1,
    total: 1,
    status,
    metadata,
  });
}

/**
 * Create a progress reporter bound to a task run.
 * Usage:
 *   const reporter = createProgressReporter(supabase, taskRunId, 100);
 *   for (let i = 0; i < 100; i++) {
 *     await reporter({ current: i, currentItem: `Processing item ${i}` });
 *   }
 */
export function createProgressReporter(
  _supabase: unknown,
  taskRunId: string,
  total: number
) {
  let current = 0;

  return async (progress: Partial<{ current: number; currentItem: string; status: "starting" | "running" | "completed" | "failed" }>) => {
    if (progress.current !== undefined) current = progress.current;
    const payload = {
      current,
      total,
      currentItem: progress.currentItem,
      status: progress.status ?? "running",
    };
    await reportProgress(
      _supabase,
      taskRunId,
      payload as { current: number; total: number; currentItem?: string; status: "starting" | "running" | "completed" | "failed" }
    );
  };
}

/**
 * Increment helper for simple loops.
 */
export function createIncrementalReporter(
  _supabase: unknown,
  taskRunId: string,
  total: number
) {
  let current = 0;

  return async (currentItem?: string) => {
    current++;
    await reportProgress(_supabase, taskRunId, {
      current,
      total,
      currentItem,
      status: current >= total ? "completed" : "running",
    });
  };
}
