"use client";

import { useSyncExternalStore, useEffect, useState, useCallback } from "react";
import type { TimerState, TimerStatus } from "./types";

const STORAGE_KEY = "__workspace_work_timer_v1__";
const CHANNEL_NAME = "__workspace_work_timer_channel__";

const DEFAULT_STATE: TimerState = {
  status: "idle",
  startedAt: null,
  pausedAt: null,
  accumulatedSeconds: 0,
  project: "AI Venture",
  note: "",
  lastUpdated: Date.now(),
};

function getInitialState(): TimerState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<TimerState>;
    return {
      status: parsed.status || "idle",
      startedAt: parsed.startedAt ?? null,
      pausedAt: parsed.pausedAt ?? null,
      accumulatedSeconds: Number(parsed.accumulatedSeconds) || 0,
      project: parsed.project || "AI Venture",
      note: parsed.note || "",
      lastUpdated: parsed.lastUpdated || Date.now(),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

class TimerStoreManager {
  private state: TimerState = DEFAULT_STATE;
  private listeners = new Set<() => void>();
  private channel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.state = getInitialState();

      try {
        if ("BroadcastChannel" in window) {
          this.channel = new BroadcastChannel(CHANNEL_NAME);
          this.channel.onmessage = (event) => {
            if (event.data && typeof event.data === "object") {
              this.state = event.data as TimerState;
              this.notify();
            }
          };
        }
      } catch {
        // BroadcastChannel unavailable
      }

      window.addEventListener("storage", (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
          try {
            this.state = JSON.parse(e.newValue);
            this.notify();
          } catch {
            // Ignore
          }
        }
      });
    }
  }

  public getSnapshot = (): TimerState => {
    return this.state;
  };

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private persist(newState: TimerState) {
    this.state = newState;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        this.channel?.postMessage(newState);
      } catch {
        // Storage full or private mode
      }
    }
    this.notify();
  }

  public start(project?: string, note?: string) {
    const now = Date.now();
    const newState: TimerState = {
      status: "running",
      startedAt: now,
      pausedAt: null,
      accumulatedSeconds: 0,
      project: project ?? this.state.project ?? "AI Venture",
      note: note ?? this.state.note ?? "",
      lastUpdated: now,
    };
    this.persist(newState);
  }

  public pause() {
    if (this.state.status !== "running" || !this.state.startedAt) return;
    const now = Date.now();
    const elapsedSinceStart = Math.max(0, Math.floor((now - this.state.startedAt) / 1000));
    const totalAccumulated = this.state.accumulatedSeconds + elapsedSinceStart;
    const newState: TimerState = {
      ...this.state,
      status: "paused",
      startedAt: null,
      pausedAt: now,
      accumulatedSeconds: totalAccumulated,
      lastUpdated: now,
    };
    this.persist(newState);
  }

  public resume() {
    if (this.state.status !== "paused") return;
    const now = Date.now();
    const newState: TimerState = {
      ...this.state,
      status: "running",
      startedAt: now,
      pausedAt: null,
      lastUpdated: now,
    };
    this.persist(newState);
  }

  public getElapsedSeconds(): number {
    if (this.state.status === "idle") return 0;
    if (this.state.status === "paused" || !this.state.startedAt) {
      return this.state.accumulatedSeconds;
    }
    const now = Date.now();
    const currentRun = Math.max(0, Math.floor((now - this.state.startedAt) / 1000));
    return this.state.accumulatedSeconds + currentRun;
  }

  public updateContext(project: string, note?: string) {
    const newState: TimerState = {
      ...this.state,
      project,
      note: note !== undefined ? note : this.state.note,
      lastUpdated: Date.now(),
    };
    this.persist(newState);
  }

  public stop(finalNote?: string): {
    startTime: string;
    endTime: string;
    duration: number;
    project: string;
    note: string;
  } | null {
    if (this.state.status === "idle") return null;

    const duration = this.getElapsedSeconds();
    if (duration < 3) {
      // Ignore accidental clicks under 3 seconds
      this.reset();
      return null;
    }

    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - duration * 1000).toISOString();
    const result = {
      startTime,
      endTime,
      duration,
      project: this.state.project || "AI Venture",
      note: finalNote !== undefined ? finalNote : (this.state.note || ""),
    };

    this.reset();
    return result;
  }

  public reset() {
    const newState: TimerState = {
      ...DEFAULT_STATE,
      project: this.state.project || "AI Venture",
      lastUpdated: Date.now(),
    };
    this.persist(newState);
  }
}

export const timerStore = new TimerStoreManager();

/**
 * React hook that subscribes to the work timer and returns live ticking seconds.
 */
export function useWorkTimer() {
  const state = useSyncExternalStore(
    timerStore.subscribe,
    timerStore.getSnapshot,
    () => DEFAULT_STATE
  );

  const [elapsed, setElapsed] = useState(() => timerStore.getElapsedSeconds());

  useEffect(() => {
    // Immediate sync on state change
    setElapsed(timerStore.getElapsedSeconds());

    if (state.status !== "running") return;

    const interval = setInterval(() => {
      setElapsed(timerStore.getElapsedSeconds());
    }, 1000);

    return () => clearInterval(interval);
  }, [state.status, state.startedAt, state.accumulatedSeconds]);

  const start = useCallback((project?: string, note?: string) => timerStore.start(project, note), []);
  const pause = useCallback(() => timerStore.pause(), []);
  const resume = useCallback(() => timerStore.resume(), []);
  const stop = useCallback((note?: string) => timerStore.stop(note), []);
  const reset = useCallback(() => timerStore.reset(), []);
  const updateContext = useCallback((project: string, note?: string) => timerStore.updateContext(project, note), []);

  return {
    state,
    elapsed,
    isRunning: state.status === "running",
    isPaused: state.status === "paused",
    isIdle: state.status === "idle",
    start,
    pause,
    resume,
    stop,
    reset,
    updateContext,
  };
}

export function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatDurationHuman(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}
