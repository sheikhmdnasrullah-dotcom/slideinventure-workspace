import { EventType, type BaseEvent } from "@ag-ui/client";

export {
  AGENT_STAGES,
  STAGE_LABELS,
  agentStatusLabel,
  aguiToDomainEventType,
  type AgentStage,
  type StageStatus,
} from "@/lib/agui/protocol";

/**
 * Client-local AG-UI event bus.
 *
 * Scope note: this is only for events that originate and are consumed inside a
 * single browser tab (an optimistic UI tick while a fetch is in flight). Agent
 * events that the dashboard must react to are emitted server-side by
 * lib/agui/server.ts and delivered over /api/events/stream, because the agent
 * runs on the server and a client bus cannot see it. Use useLiveEvents() to
 * consume those.
 */

type Listener = (event: BaseEvent) => void;

const listeners = new Set<Listener>();

export function emitAgentEvent(event: BaseEvent) {
  for (const l of listeners) {
    try {
      l(event);
    } catch {
      /* a broken listener must not stop the others */
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

export function emitStepStarted(runId: string, stepName: string) {
  emitAgentEvent({ type: EventType.STEP_STARTED, runId, stepName } as BaseEvent);
}

export function emitStepFinished(runId: string, stepName: string) {
  emitAgentEvent({ type: EventType.STEP_FINISHED, runId, stepName } as BaseEvent);
}

export function emitRunFinished(runId: string) {
  emitAgentEvent({ type: EventType.RUN_FINISHED, runId } as BaseEvent);
}

export function emitRunError(runId: string, message: string) {
  emitAgentEvent({ type: EventType.RUN_ERROR, runId, message } as BaseEvent);
}

export { EventType };
