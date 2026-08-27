import { EventType } from "@ag-ui/client";
import type { DomainEventType } from "@/lib/events/types";

/**
 * AG-UI protocol vocabulary, client-safe.
 *
 * The dashboard speaks the official `EventType` enum from @ag-ui/client so an
 * agent backend (Mastra, LangGraph, a Temporal worker) can stream standard
 * AG-UI events without knowing anything about this app, and the UI still gets
 * usable status. This module only holds the enum mapping and stage names, so it
 * can be imported from client components; the actual emission lives in
 * lib/agui/server.ts.
 */

export type AgentStage =
  | "input"
  | "browser"
  | "captcha"
  | "crawl"
  | "truemail"
  | "lead";

export const AGENT_STAGES: AgentStage[] = [
  "input",
  "browser",
  "captcha",
  "crawl",
  "truemail",
  "lead",
];

export const STAGE_LABELS: Record<AgentStage, string> = {
  input: "Input",
  browser: "Browser",
  captcha: "Captcha",
  crawl: "Crawl",
  truemail: "Verify",
  lead: "Lead",
};

/** Status of one stage in a run, as rendered by the flow canvas. */
export type StageStatus = "idle" | "running" | "done" | "error";

/**
 * Translate an AG-UI protocol event into this app's domain event name, so agent
 * traffic lands in the same feed as everything else instead of a separate
 * technical log.
 */
export function aguiToDomainEventType(type: EventType | string): DomainEventType {
  switch (type) {
    case EventType.RUN_STARTED:
      return "agent.started";
    case EventType.RUN_FINISHED:
      return "agent.completed";
    case EventType.RUN_ERROR:
      return "agent.failed";
    case EventType.STEP_STARTED:
      return "agent.tool.started";
    case EventType.STEP_FINISHED:
      return "agent.tool.completed";
    case EventType.TEXT_MESSAGE_START:
    case EventType.TEXT_MESSAGE_CONTENT:
      return "agent.thinking";
    case EventType.TOOL_CALL_START:
      return "agent.tool.started";
    case EventType.TOOL_CALL_END:
      return "agent.tool.completed";
    default:
      return "agent.thinking";
  }
}

/**
 * User-facing status line for an agent event. Deliberately reports what the
 * agent is doing, never its reasoning: no chain-of-thought reaches the UI.
 */
export function agentStatusLabel(type: string, metadata?: Record<string, unknown>): string {
  const stage = typeof metadata?.stage === "string" ? metadata.stage : undefined;
  const tool = typeof metadata?.tool === "string" ? metadata.tool : undefined;
  switch (type) {
    case "agent.started":
      return "Started";
    case "agent.thinking":
      return "Working";
    case "agent.tool.started":
      return tool ? `Running ${tool}` : stage ? `${stage}` : "Running step";
    case "agent.tool.completed":
      return tool ? `Finished ${tool}` : stage ? `${stage} done` : "Step done";
    case "agent.approval.required":
      return "Waiting for approval";
    case "agent.completed":
      return "Completed";
    case "agent.failed":
      return "Failed";
    default:
      return "Working";
  }
}

export { EventType };
