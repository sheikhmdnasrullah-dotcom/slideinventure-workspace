import { EventType, type BaseEvent } from "@ag-ui/client";

// Lightweight AG-UI-shaped event bus. Emits agent lifecycle events using the
// official ag-ui `EventType` enum so any subscriber (canvas, logs, copilot)
// speaks the same protocol as CopilotKit.
export type AgentStage =
  | "input"
  | "browser"
  | "captcha"
  | "crawl"
  | "truemail"
  | "lead";

type Listener = (event: BaseEvent) => void;

const listeners = new Set<Listener>();

export function emitAgentEvent(event: BaseEvent) {
  for (const l of listeners) {
    try {
      l(event);
    } catch {
      /* ignore listener errors */
    }
  }
}

export function onAgentEvent(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitRunStarted(runId: string) {
  emitAgentEvent({ type: EventType.RUN_STARTED, runId } as BaseEvent);
}

export function emitStepStarted(runId: string, stage: AgentStage) {
  emitAgentEvent({
    type: EventType.STEP_STARTED,
    runId,
    stepName: stage,
  } as BaseEvent);
}

export function emitStepFinished(runId: string, stage: AgentStage) {
  emitAgentEvent({
    type: EventType.STEP_FINISHED,
    runId,
    stepName: stage,
  } as BaseEvent);
}

export function emitRunFinished(runId: string) {
  emitAgentEvent({ type: EventType.RUN_FINISHED, runId } as BaseEvent);
}

export function emitRunError(runId: string, message: string) {
  emitAgentEvent({
    type: EventType.RUN_ERROR,
    runId,
    message,
  } as BaseEvent);
}

export const AGENT_STAGES: AgentStage[] = [
  "input",
  "browser",
  "captcha",
  "crawl",
  "truemail",
  "lead",
];
