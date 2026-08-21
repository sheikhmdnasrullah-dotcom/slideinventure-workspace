/**
 * Agent execution types and registry.
 *
 * Extends the existing task_runs system with typed agent types and
 * progress reporting for the "43/100" UX.
 */

import { z } from "zod";

/**
 * Known agent types. Each maps to a runner implementation.
 */
export const AgentType = {
  RESEARCH: "research",
  COMPANY_ANALYSIS: "company_analysis",
  SOP_AUTHOR: "sop_author",
  OUTREACH_RESEARCH: "outreach_research",
  FILE_PROCESS: "file_process",
  GENERIC_SCRIPT: "script",
  COLD_EMAIL: "cold_email",
  AUTOMATION: "automation",
  SYSTEM: "system",
} as const;

export type AgentType = (typeof AgentType)[keyof typeof AgentType];
export const AGENT_TYPE_KEYS = Object.values(AgentType);

/**
 * Progress payload for task_run_events.
 */
export const ProgressPayloadSchema = z.object({
  current: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  currentItem: z.string().optional(),
  status: z.enum(["starting", "running", "completed", "failed"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ProgressStatus = z.infer<typeof ProgressPayloadSchema.shape.status>;

export type ProgressPayload = z.infer<typeof ProgressPayloadSchema>;

/**
 * Task run metadata extending the base schema with agent-specific fields.
 */
export const TaskRunMetadataSchema = z.object({
  agentType: z.enum([...AGENT_TYPE_KEYS] as [string, ...string[]]).optional(),
  progress: ProgressPayloadSchema.optional(),
  counters: z
    .object({
      created: z.number().int().nonnegative().optional(),
      updated: z.number().int().nonnegative().optional(),
      skipped: z.number().int().nonnegative().optional(),
      failed: z.number().int().nonnegative().optional(),
    })
    .optional(),
  source: z.string().optional(),
  triggeredBy: z.enum(["dashboard", "cli", "n8n", "api", "scheduled"]).optional(),
});

export type TaskRunMetadata = z.infer<typeof TaskRunMetadataSchema>;

/**
 * Agent runner interface. Each agent type implements this.
 */
export interface AgentRunner {
  type: AgentType;
  description: string;
  // Execute the agent, reporting progress via callback
  execute: (
    input: Record<string, unknown>,
    onProgress: (progress: { current: number; total: number; currentItem?: string; status?: ProgressStatus }) => Promise<void>
  ) => Promise<{ output: string; metadata?: TaskRunMetadata }>;
};

/**
 * Registry of available agent runners.
 */
export class AgentRegistry {
  private runners = new Map<AgentType, AgentRunner>();

  register(runner: AgentRunner) {
    this.runners.set(runner.type, runner);
  }

  get(type: AgentType): AgentRunner | undefined {
    return this.runners.get(type);
  }

  list(): AgentRunner[] {
    return Array.from(this.runners.values());
  }

  has(type: AgentType): boolean {
    return this.runners.has(type);
  }
}

export const agentRegistry = new AgentRegistry();

// Register built-in agents
import { researchRunner } from "./runners/research";
agentRegistry.register(researchRunner);