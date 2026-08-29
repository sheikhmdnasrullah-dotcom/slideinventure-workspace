/**
 * Shared domain-event model.
 *
 * One vocabulary for "something meaningful happened" that every section emits
 * and the dashboard, activity feed, and copilot consume. Events are derived
 * automatically from activity writes (see lib/activities/client.ts) so adding a
 * new persisted action does not require touching the dashboard.
 *
 * Safe to import from both server and client code: types plus pure mapping
 * helpers only, no Appwrite or node imports.
 */

import type { ActivityAction, ActivityCategory } from "@/lib/activities/types";

/** Where the event came from, in product terms rather than file paths. */
export type EventSource =
  | "dashboard"
  | "chat"
  | "agents"
  | "ai-venture"
  | "research-lab"
  | "brainstorm"
  | "knowledge"
  | "documents"
  | "notes"
  | "leads"
  | "terminal"
  | "links"
  | "vault"
  | "integrations"
  | "todoist"
  | "ideas"
  | "system";

/**
 * Dotted `subject.verb` names. The listed values are the ones the UI knows how
 * to label and route; the template fallback keeps the layer open so a new
 * section can emit without a type change here first.
 */
export type DomainEventType =
  // agent lifecycle (bridged from the AG-UI protocol)
  | "agent.started"
  | "agent.thinking"
  | "agent.tool.started"
  | "agent.tool.completed"
  | "agent.approval.required"
  | "agent.completed"
  | "agent.failed"
  // research
  | "research.started"
  | "research.source_found"
  | "research.completed"
  | "research.created"
  | "research.updated"
  | "research.deleted"
  // artefacts
  | "file.created"
  | "file.updated"
  | "file.deleted"
  | "note.created"
  | "note.updated"
  | "note.deleted"
  | "board.created"
  | "board.updated"
  | "board.deleted"
  | "ideas.created"
  | "ideas.updated"
  | "ideas.deleted"
  | "knowledge.created"
  | "knowledge.updated"
  | "knowledge.deleted"
  // work
  | "task.created"
  | "task.completed"
  | "lead.imported"
  | "lead.completed"
  | "terminal.finding_saved"
  | "chat.messaged"
  | (`${string}.${string}` & {});

export type DomainEvent = {
  id: string;
  type: DomainEventType;
  source: EventSource;
  title: string;
  description: string;
  timestamp: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, unknown>;
  userEmail?: string;
};

/** Category -> product source. Keeps the feed labelled in user language. */
const SOURCE_BY_CATEGORY: Record<ActivityCategory, EventSource> = {
  leads: "leads",
  documents: "documents",
  knowledge: "knowledge",
  chat: "chat",
  ai_venture: "ai-venture",
  todoist: "todoist",
  notes: "notes",
  terminal: "terminal",
  links: "links",
  vault: "vault",
  integrations: "integrations",
  agents: "agents",
  concepts: "ai-venture",
  brainstorm: "brainstorm",
  system: "system",
};

/** Category -> the noun used in the event name. */
const SUBJECT_BY_CATEGORY: Record<ActivityCategory, string> = {
  leads: "lead",
  documents: "file",
  knowledge: "knowledge",
  chat: "chat",
  ai_venture: "file",
  todoist: "task",
  notes: "note",
  terminal: "terminal",
  links: "link",
  vault: "secret",
  integrations: "integration",
  agents: "agent",
  concepts: "file",
  brainstorm: "board",
  system: "system",
};

export function sourceForCategory(category: ActivityCategory): EventSource {
  return SOURCE_BY_CATEGORY[category] ?? "system";
}

/** Entity types whose own noun is more accurate than the category's. */
const SUBJECT_BY_ENTITY_TYPE: Record<string, string> = {
  note: "note",
  board: "board",
  whiteboard: "board",
  affine_workspace: "board",
  idea_map: "ideas",
  document: "file",
  file: "file",
  folder: "file",
  knowledge_item: "knowledge",
  research_thread: "research",
  research_item: "research",
  finding: "research",
  source: "research",
  decision: "research",
  experiment: "research",
  agent_run: "agent",
  lead: "lead",
  task: "task",
};

/**
 * Derive a domain event name from a persisted activity, so every existing
 * logActivity() call site publishes a usable live event with no edit.
 *
 * The entity type wins over the category when it is more specific: a note saved
 * inside AI Venture is a `note.created`, not a `file.created`, even though its
 * activity category is `ai_venture`.
 */
export function eventTypeForActivity(
  category: ActivityCategory,
  action: ActivityAction,
  entityType?: string
): DomainEventType {
  const subject =
    (entityType && SUBJECT_BY_ENTITY_TYPE[entityType]) ??
    SUBJECT_BY_CATEGORY[category] ??
    "item";
  switch (action) {
    case "uploaded":
      return `${subject}.created` as DomainEventType;
    case "edited":
    case "renamed":
    case "moved":
      return `${subject}.updated` as DomainEventType;
    case "executed":
      return `${subject}.started` as DomainEventType;
    default:
      return `${subject}.${action}` as DomainEventType;
  }
}

/** Human label for an event type, used by the feed and dashboard. */
export function labelForEventType(type: string): string {
  const [subject, ...rest] = type.split(".");
  const verb = rest.join(" ").replace(/_/g, " ");
  const noun = subject.replace(/_/g, " ");
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${verb}`.trim();
}

/** Event types that represent work finishing, worth surfacing prominently. */
export function isCompletionEvent(type: string): boolean {
  return (
    type.endsWith(".completed") ||
    type.endsWith(".imported") ||
    type === "terminal.finding_saved"
  );
}

/** Event types that represent a failure the user should notice. */
export function isFailureEvent(type: string): boolean {
  return type.endsWith(".failed") || type.endsWith(".error");
}
