/**
 * Progress reporting utilities for agent runners.
 * Writes progress events to task_run_events for live "43/100" UX.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ProgressPayload, TaskRunMetadata } from "./registry";

/**
 * Report progress for a task run. Writes to task_run_events with
 * monotonically increasing sequence numbers.
 */
export async function reportProgress(
  supabase: SupabaseClient,
  taskRunId: string,
  progress: ProgressPayload
): Promise<void> {
  // Get next sequence number
  const { data: latest } = await supabase
    .from("task_run_events")
    .select("sequence")
    .eq("task_run_id", taskRunId)
    .order("sequence", { ascending: false })
    .limit(1)
    .single();

  const sequence = (latest?.sequence ?? 0) + 1;

  const { error } = await supabase.from("task_run_events").insert({
    task_run_id: taskRunId,
    sequence,
    current: progress.current,
    total: progress.total,
    current_item: progress.currentItem,
    status: progress.status ?? "running",
    metadata: progress.metadata ?? {},
  });

  if (error) {
    console.error("Progress report failed:", error);
  }
}

/**
 * Complete a task run with final status.
 */
export async function completeTaskRun(
  supabase: SupabaseClient,
  taskRunId: string,
  status: "completed" | "failed",
  output: string,
  exitCode: number,
  metadata?: TaskRunMetadata
): Promise<void> {
  const { error } = await supabase
    .from("task_runs")
    .update({
      status,
      output,
      exit_code: exitCode,
      completed_at: new Date().toISOString(),
      metadata: metadata ?? {},
    })
    .eq("id", taskRunId);

  if (error) {
    console.error("Task completion update failed:", error);
  }

  // Also emit final progress event
  await reportProgress(supabase, taskRunId, {
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
  supabase: SupabaseClient,
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
      supabase,
      taskRunId,
      payload as { current: number; total: number; currentItem?: string; status: "starting" | "running" | "completed" | "failed" }
    );
  };
}

/**
 * Increment helper for simple loops.
 */
export function createIncrementalReporter(
  supabase: SupabaseClient,
  taskRunId: string,
  total: number
) {
  let current = 0;

  return async (currentItem?: string) => {
    current++;
    await reportProgress(supabase, taskRunId, {
      current,
      total,
      currentItem,
      status: current >= total ? "completed" : "running",
    });
  };
}