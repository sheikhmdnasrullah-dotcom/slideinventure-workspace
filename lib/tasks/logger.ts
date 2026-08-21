import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type TaskType = "script" | "research" | "cold_email" | "automation" | "system" | "company_analysis" | "sop_author" | "outreach_research" | "file_process";

interface TaskRunOptions {
  task_type: TaskType;
  command?: string;
  triggered_by?: string;
  knowledge_item_id?: string;
  metadata?: Record<string, unknown>;
}

export async function startTaskRun(options: TaskRunOptions) {
  const id = randomUUID();
  const { error } = await supabase.from("task_runs").insert({
    id,
    task_type: options.task_type,
    status: "running",
    command: options.command ?? null,
    triggered_by: options.triggered_by ?? null,
    knowledge_item_id: options.knowledge_item_id ?? null,
    metadata: options.metadata ?? {},
  });

  if (error) {
    throw new Error(`Failed to start task run: ${error.message}`);
  }

  return id;
}

export async function completeTaskRun(id: string, output: string, exit_code: number) {
  const { error } = await supabase
    .from("task_runs")
    .update({
      status: exit_code === 0 ? "completed" : "failed",
      output,
      exit_code,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to complete task run: ${error.message}`);
  }
}

export async function failTaskRun(id: string, errorMessage: string) {
  const { error } = await supabase
    .from("task_runs")
    .update({
      status: "failed",
      output: errorMessage,
      exit_code: 1,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to mark task run as failed: ${error.message}`);
  }
}
