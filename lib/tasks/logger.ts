import { Client, Databases, ID } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";

// Self-contained Appwrite client (service role). This module is imported by both
// the Next.js server runtime and the standalone `scripts/agent.ts` Node script, so
// it intentionally constructs its own client instead of pulling in the
// "server-only" `@/lib/appwrite/server` wrapper.
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.taskRuns;

export type TaskType =
  | "script"
  | "research"
  | "cold_email"
  | "automation"
  | "system"
  | "company_analysis"
  | "sop_author"
  | "outreach_research"
  | "file_process";

interface TaskRunOptions {
  task_type: TaskType;
  command?: string;
  triggered_by?: string;
  knowledge_item_id?: string;
  metadata?: Record<string, unknown>;
}

export async function startTaskRun(options: TaskRunOptions) {
  const id = ID.unique();
  const now = new Date().toISOString();

  try {
    await databases.createDocument(DB, COL, id, {
      task_type: options.task_type,
      status: "running",
      command: options.command ?? null,
      triggered_by: options.triggered_by ?? null,
      knowledge_item_id: options.knowledge_item_id ?? null,
      metadata: JSON.stringify(options.metadata ?? {}),
      started_at: now,
    });
  } catch (error) {
    throw new Error(`Failed to start task run: ${(error as Error).message}`);
  }

  return id;
}

export async function completeTaskRun(id: string, output: string, exit_code: number) {
  try {
    await databases.updateDocument(DB, COL, id, {
      status: exit_code === 0 ? "completed" : "failed",
      output,
      exit_code,
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    throw new Error(`Failed to complete task run: ${(error as Error).message}`);
  }
}

export async function failTaskRun(id: string, errorMessage: string) {
  try {
    await databases.updateDocument(DB, COL, id, {
      status: "failed",
      output: errorMessage,
      exit_code: 1,
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    throw new Error(`Failed to mark task run as failed: ${(error as Error).message}`);
  }
}
