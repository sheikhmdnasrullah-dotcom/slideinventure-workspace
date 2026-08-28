"use client";

// Per-agent conversation + run state that lives outside React so agent runs keep
// going (and stay visible) even when the user switches agents or navigates away
// from the AI Venture section. Persisted to localStorage so a background run
// survives a full page reload.

export type AgentMsg = { role: "user" | "assistant"; content: string };

export type AgentRunState = {
  messages: AgentMsg[];
  status: string;
  answer: string | null;
  error: string | null;
  busy: boolean;
  runId: string | null;
};

const KEY = "av-agent-conversations-v1";
const store = new Map<string, AgentRunState>();
const listeners = new Set<() => void>();

function emptyState(): AgentRunState {
  return { messages: [], status: "", answer: null, error: null, busy: false, runId: null };
}

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, AgentRunState>;
      for (const k of Object.keys(obj)) store.set(k, obj[k]);
    }
  } catch {
    /* ignore */
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(store)));
  } catch {
    /* ignore */
  }
}

load();

function notify() {
  persist();
  listeners.forEach((l) => l());
}

export function getAgentState(slug: string): AgentRunState {
  let s = store.get(slug);
  if (!s) {
    s = emptyState();
    store.set(slug, s);
  }
  return s;
}

export function getStoreSnapshot(): Record<string, AgentRunState> {
  return Object.fromEntries(store);
}

export function updateAgentState(slug: string, patch: Partial<AgentRunState>) {
  const cur = store.get(slug) ?? emptyState();
  store.set(slug, { ...cur, ...patch });
  notify();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
