"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export type AutosaveBeacon =
  | { url: string; body: string; method?: "POST" | "PUT"; headers?: Record<string, string> }
  | null;

export type CanvasAutosaveOptions<T> = {
  /** Performs the actual PUT. Throwing signals a failed save. */
  save: (payload: T) => Promise<void>;
  /** Debounce window in ms. Default 700. */
  delay?: number;
  /**
   * Builds a transport for the unload path. When provided, the hook flushes
   * the pending payload with navigator.sendBeacon (POST) or fetch with
   * keepalive (PUT) so the write survives a teardown that kills async work.
   */
  beacon?: (payload: T) => AutosaveBeacon;
  /**
   * Coalesces queued payloads. Defaults to replacing with the latest payload
   * ("coalescing rapid changes to the latest payload"). Pass a merge (e.g.
   * (prev, next) => ({ ...prev, ...next })) when independent fields must all be
   * preserved across a single debounce window.
   */
  merge?: (prev: T | null, next: T) => T;
};

export type CanvasAutosaveApi<T> = {
  state: SaveState;
  lastSavedAt: Date | null;
  /** Call on every change with the latest payload for that change. */
  queue: (payload: T) => void;
  /** Force a save now (debounce skipped). Returns when the save settles. */
  flush: () => Promise<void>;
};

export function useCanvasAutosave<T>({
  save,
  delay = 700,
  beacon,
  merge,
}: CanvasAutosaveOptions<T>): CanvasAutosaveApi<T> {
  const [state, setState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const pendingRef = useRef<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const stateRef = useRef<SaveState>("idle");

  // Keep latest callbacks/options without retriggering the effect graph.
  const saveRef = useRef(save);
  const beaconRef = useRef(beacon);
  const mergeRef = useRef(merge);
  saveRef.current = save;
  beaconRef.current = beacon;
  mergeRef.current = merge;

  const setSaveState = useCallback((next: SaveState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const runOnce = useCallback(async () => {
    // Drain everything that is pending, including payloads that arrive while a
    // save is in flight, so nothing is lost.
    while (pendingRef.current !== null) {
      const payload = pendingRef.current;
      pendingRef.current = null;
      if (mountedRef.current) setSaveState("saving");

      let ok = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await saveRef.current(payload);
          ok = true;
          break;
        } catch {
          // retry once before reporting an error
        }
      }

      if (ok) {
        if (mountedRef.current) {
          setLastSavedAt(new Date());
          setSaveState("saved");
        }
        // loop continues if another payload queued during the await above
      } else {
        // re-queue so a later flush/queue can retry; report error honestly
        pendingRef.current = payload;
        if (mountedRef.current) setSaveState("error");
        return;
      }
    }
  }, [setSaveState]);

  const doSave = useCallback(() => {
    const run = chainRef.current.then(runOnce).catch(() => {});
    chainRef.current = run;
    return run;
  }, [runOnce]);

  const unloadFlush = useCallback(() => {
    const payload = pendingRef.current;
    if (payload === null) return;
    const spec = beaconRef.current?.(payload);
    if (!spec) return;
    const method = spec.method ?? "PUT";
    const headers = spec.headers ?? { "Content-Type": "application/json" };
    // sendBeacon only supports POST, so it is used for POST beacons; PUT
    // (our board/affine endpoints) relies on fetch with keepalive, which also
    // survives page teardown. A normal async fetch does not.
    if (method === "POST" && typeof navigator.sendBeacon === "function") {
      try {
        const ok = navigator.sendBeacon(
          spec.url,
          new Blob([spec.body], { type: "application/json" })
        );
        if (ok) return;
      } catch {
        // fall through to fetch keepalive
      }
    }
    try {
      fetch(spec.url, { method, headers, body: spec.body, keepalive: true }).catch(() => {});
    } catch {
      // nothing else we can do during unload
    }
  }, []);

  const queue = useCallback(
    (payload: T) => {
      const merged = mergeRef.current
        ? mergeRef.current(pendingRef.current, payload)
        : payload;
      pendingRef.current = merged;
      if (mountedRef.current && stateRef.current !== "saving") {
        setSaveState("dirty");
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        doSave();
      }, delay);
    },
    [delay, doSave, setSaveState]
  );

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return doSave();
  }, [doSave]);

  useEffect(() => {
    mountedRef.current = true;
    const onBeforeUnload = () => unloadFlush();
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        unloadFlush();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [unloadFlush]);

  // Flush pending work on unmount. When a beacon is configured this is reliable
  // even during teardown; otherwise we attempt a best-effort async save (works
  // for in-app modal closes where the page itself is not unloading).
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (pendingRef.current !== null) {
        unloadFlush();
        if (!beaconRef.current) {
          doSave().catch(() => {});
        }
      }
    };
  }, [unloadFlush, doSave]);

  return { state, lastSavedAt, queue, flush };
}
