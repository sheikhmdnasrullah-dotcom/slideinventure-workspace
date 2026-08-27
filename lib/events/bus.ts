import "server-only";
import type { DomainEvent, DomainEventType, EventSource } from "@/lib/events/types";

/**
 * Server-side fan-out for domain events.
 *
 * Publishers (any route handler or server action) call publishEvent(). Every
 * connected browser holds one SSE stream from /api/events/stream and receives
 * the event immediately, which is what lets the dashboard update without
 * polling each section.
 *
 * The registry is per-process and deliberately so: this app runs as a single
 * Node process (next start / pm2 single instance), and events are ephemeral
 * notifications whose durable record already lives in the Appwrite `activities`
 * collection. A dropped broadcast costs a live tick, never data: the client
 * refetches /api/activities on reconnect.
 */

type Subscriber = {
  id: string;
  userEmail: string | null;
  send: (event: DomainEvent) => void;
};

// Small replay ring so a browser that reconnects mid-run does not miss the
// events that fired during the gap.
const RECENT_LIMIT = 50;

type Registry = {
  subscribers: Set<Subscriber>;
  recent: DomainEvent[];
};

/**
 * Pinned to globalThis on purpose.
 *
 * Next bundles each route handler separately, so a module holding mutable
 * top-level state gets a fresh copy per route chunk. Without this, the Set that
 * /api/events/stream subscribes into is a different Set from the one
 * /api/notes publishes to, and every broadcast silently goes nowhere. The
 * global key keeps one registry per process, which also survives dev hot
 * reloads instead of dropping live connections.
 */
const globalKey = "__workspaceEventRegistry__" as const;

type GlobalWithRegistry = typeof globalThis & { [globalKey]?: Registry };

function registry(): Registry {
  const g = globalThis as GlobalWithRegistry;
  if (!g[globalKey]) {
    g[globalKey] = { subscribers: new Set<Subscriber>(), recent: [] };
  }
  return g[globalKey];
}

export function subscribe(sub: Subscriber): () => void {
  const reg = registry();
  reg.subscribers.add(sub);
  return () => {
    reg.subscribers.delete(sub);
  };
}

export function subscriberCount(): number {
  return registry().subscribers.size;
}

export function recentEvents(since?: string): DomainEvent[] {
  const { recent } = registry();
  if (!since) return [...recent];
  const idx = recent.findIndex((e) => e.id === since);
  return idx === -1 ? [...recent] : recent.slice(idx + 1);
}

export type PublishInput = {
  type: DomainEventType;
  source: EventSource;
  title: string;
  description?: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, unknown>;
  userEmail?: string | null;
};

/**
 * Broadcast an event to every connected client. Never throws: a broken
 * subscriber must not take down the request that produced the event.
 */
export function publishEvent(input: PublishInput): DomainEvent {
  const event: DomainEvent = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    source: input.source,
    title: input.title,
    description: input.description ?? "",
    timestamp: new Date().toISOString(),
    entityId: input.entityId,
    entityType: input.entityType,
    metadata: input.metadata,
    userEmail: input.userEmail ?? undefined,
  };

  const { subscribers, recent } = registry();

  recent.push(event);
  if (recent.length > RECENT_LIMIT) recent.splice(0, recent.length - RECENT_LIMIT);

  for (const sub of subscribers) {
    // Single-tenant workspace, but scope anyway so a shared deployment cannot
    // leak one account's activity into another's feed.
    if (event.userEmail && sub.userEmail && event.userEmail !== sub.userEmail) continue;
    try {
      sub.send(event);
    } catch {
      subscribers.delete(sub);
    }
  }

  return event;
}
