import "server-only";
import { EventType, type BaseEvent } from "@ag-ui/client";
import { publishEvent } from "@/lib/events/bus";
import { aguiToDomainEventType, type AgentStage } from "@/lib/agui/protocol";
import { logActivity } from "@/lib/activities/client";

/**
 * Server-side AG-UI emitter.
 *
 * Agent backends emit standard AG-UI events here; this translates them into the
 * shared domain-event stream so the dashboard, activity feed and copilot all
 * react to agent work in real time. Run start/finish/failure additionally get a
 * durable activity row, because those are the moments a user cares about after
 * the fact. Intermediate steps stay ephemeral so the feed does not fill with
 * technical noise.
 */

export type AgentRunContext = {
  runId: string;
  /** Agent name shown to the user, e.g. "Research agent". */
  agent: string;
  userEmail?: string | null;
};

function publish(
  ctx: AgentRunContext,
  aguiType: EventType,
  title: string,
  description: string,
  metadata: Record<string, unknown> = {}
) {
  publishEvent({
    type: aguiToDomainEventType(aguiType),
    source: "agents",
    title,
    description,
    entityId: ctx.runId,
    entityType: "agent_run",
    metadata: { ...metadata, runId: ctx.runId, agent: ctx.agent, agui: aguiType },
    userEmail: ctx.userEmail ?? null,
  });
}

/** Raw AG-UI event passthrough for backends that already build BaseEvents. */
export function emitAguiEvent(ctx: AgentRunContext, event: BaseEvent) {
  publish(
    ctx,
    event.type as EventType,
    ctx.agent,
    "",
    event as unknown as Record<string, unknown>
  );
}

export async function agentRunStarted(ctx: AgentRunContext, description = "") {
  publish(ctx, EventType.RUN_STARTED, `${ctx.agent} started`, description);
  await logActivity({
    category: "agents",
    action: "executed",
    title: `${ctx.agent} started`,
    description,
    entityId: ctx.runId,
    entityType: "agent_run",
    eventType: "agent.started",
    source: "agents",
  });
}

export function agentThinking(ctx: AgentRunContext, description = "") {
  publish(ctx, EventType.TEXT_MESSAGE_CONTENT, `${ctx.agent} working`, description);
}

export function agentToolStarted(
  ctx: AgentRunContext,
  tool: string,
  stage?: AgentStage
) {
  publish(ctx, EventType.TOOL_CALL_START, `${ctx.agent}: ${tool}`, "", { tool, stage });
}

export function agentToolCompleted(
  ctx: AgentRunContext,
  tool: string,
  stage?: AgentStage,
  summary = ""
) {
  publish(ctx, EventType.TOOL_CALL_END, `${ctx.agent}: ${tool} done`, summary, {
    tool,
    stage,
  });
}

export function agentStageStarted(ctx: AgentRunContext, stage: AgentStage) {
  publish(ctx, EventType.STEP_STARTED, `${ctx.agent}: ${stage}`, "", { stage });
}

export function agentStageCompleted(
  ctx: AgentRunContext,
  stage: AgentStage,
  summary = ""
) {
  publish(ctx, EventType.STEP_FINISHED, `${ctx.agent}: ${stage} done`, summary, {
    stage,
  });
}

/**
 * Emitted when an action genuinely needs a human decision. Nothing in the app
 * fabricates an approval prompt for effect: only real gated operations use it.
 */
export function agentApprovalRequired(
  ctx: AgentRunContext,
  question: string,
  metadata: Record<string, unknown> = {}
) {
  publishEvent({
    type: "agent.approval.required",
    source: "agents",
    title: `${ctx.agent} needs approval`,
    description: question,
    entityId: ctx.runId,
    entityType: "agent_run",
    metadata: { ...metadata, runId: ctx.runId, agent: ctx.agent },
    userEmail: ctx.userEmail ?? null,
  });
}

export async function agentRunCompleted(ctx: AgentRunContext, summary = "") {
  publish(ctx, EventType.RUN_FINISHED, `${ctx.agent} completed`, summary);
  await logActivity({
    category: "agents",
    action: "completed",
    title: `${ctx.agent} completed`,
    description: summary,
    entityId: ctx.runId,
    entityType: "agent_run",
    eventType: "agent.completed",
    source: "agents",
  });
}

export async function agentRunFailed(ctx: AgentRunContext, message: string) {
  publish(ctx, EventType.RUN_ERROR, `${ctx.agent} failed`, message);
  await logActivity({
    category: "agents",
    action: "executed",
    title: `${ctx.agent} failed`,
    description: message,
    entityId: ctx.runId,
    entityType: "agent_run",
    eventType: "agent.failed",
    source: "agents",
    notify: true,
  });
}

/** Convenience wrapper: runs `fn` with correct start/complete/fail events. */
export async function withAgentRun<T>(
  ctx: AgentRunContext,
  description: string,
  fn: (ctx: AgentRunContext) => Promise<T>
): Promise<T> {
  await agentRunStarted(ctx, description);
  try {
    const result = await fn(ctx);
    await agentRunCompleted(ctx, typeof result === "string" ? result : "");
    return result;
  } catch (err) {
    await agentRunFailed(ctx, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
