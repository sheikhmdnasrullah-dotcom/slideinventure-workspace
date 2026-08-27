"use client";

import * as React from "react";
import type { DomainEvent } from "@/lib/events/types";

/**
 * Client half of the shared event layer.
 *
 * A single EventSource for the whole app (mounted once in the authenticated
 * layout) instead of every section polling its own API. Sections subscribe with
 * useLiveEvents() and get told what changed, which is what keeps the dashboard
 * in sync with work done elsewhere.
 */

type Status = "connecting" | "live" | "offline";

type Store = {
  events: DomainEvent[];
  status: Status;
};

const MAX_BUFFERED = 100;

let store: Store = { events: [], status: "connecting" };
const storeListeners = new Set<() => void>();
const eventListeners = new Set<(event: DomainEvent) => void>();

function setStore(next: Partial<Store>) {
  store = { ...store, ...next };
  for (const l of storeListeners) l();
}

function subscribeStore(listener: () => void) {
  storeListeners.add(listener);
  return () => storeListeners.delete(listener);
}

function getSnapshot() {
  return store;
}

let source: EventSource | null = null;
let refCount = 0;

function openStream() {
  if (source) return;
  setStore({ status: "connecting" });
  const es = new EventSource("/api/events/stream");
  source = es;

  es.addEventListener("ready", () => setStore({ status: "live" }));

  es.addEventListener("domain", (raw) => {
    try {
      const event = JSON.parse((raw as MessageEvent).data) as DomainEvent;
      setStore({
        status: "live",
        events: [event, ...store.events].slice(0, MAX_BUFFERED),
      });
      for (const l of eventListeners) {
        try {
          l(event);
        } catch {
          /* one bad consumer must not break the rest */
        }
      }
    } catch {
      /* malformed frame: ignore rather than kill the stream */
    }
  });

  // EventSource reconnects on its own; surface the gap without tearing down so
  // the browser's own backoff does the work.
  es.onerror = () => setStore({ status: "offline" });
}

function closeStream() {
  source?.close();
  source = null;
  setStore({ status: "offline" });
}

/** Mounted once by the app layout. Owns the single connection. */
export function EventStreamProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    refCount += 1;
    openStream();
    return () => {
      refCount -= 1;
      if (refCount <= 0) closeStream();
    };
  }, []);

  return children as React.ReactElement;
}

/**
 * Read live events. Pass `types` to filter (prefix match on the dotted name, so
 * `"agent."` matches every agent event) and `onEvent` for an imperative hook,
 * typically "refetch my list".
 */
export function useLiveEvents(options?: {
  types?: string[];
  sources?: string[];
  onEvent?: (event: DomainEvent) => void;
}) {
  const { types, sources, onEvent } = options ?? {};
  const snapshot = React.useSyncExternalStore(subscribeStore, getSnapshot, getSnapshot);

  const matches = React.useCallback(
    (event: DomainEvent) => {
      if (types?.length && !types.some((t) => event.type === t || event.type.startsWith(t)))
        return false;
      if (sources?.length && !sources.includes(event.source)) return false;
      return true;
    },
    // Compared by content so a fresh array literal on each render is fine.
    [types?.join("|"), sources?.join("|")]
  );

  const handler = React.useRef(onEvent);
  handler.current = onEvent;

  React.useEffect(() => {
    if (!handler.current) return;
    const listener = (event: DomainEvent) => {
      if (matches(event)) handler.current?.(event);
    };
    eventListeners.add(listener);
    return () => {
      eventListeners.delete(listener);
    };
  }, [matches]);

  const events = React.useMemo(
    () => snapshot.events.filter(matches),
    [snapshot.events, matches]
  );

  return { events, status: snapshot.status, latest: events[0] ?? null };
}

/**
 * Convenience for list views: re-runs `refetch` (debounced) whenever a matching
 * event arrives, so a note created in AI Venture shows up in the notes list
 * without a manual refresh.
 */
export function useLiveRefresh(
  refetch: () => void | Promise<void>,
  options?: { types?: string[]; sources?: string[]; delay?: number }
) {
  const delay = options?.delay ?? 250;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const fn = React.useRef(refetch);
  fn.current = refetch;

  useLiveEvents({
    types: options?.types,
    sources: options?.sources,
    onEvent: React.useCallback(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void fn.current(), delay);
    }, [delay]),
  });

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
}
