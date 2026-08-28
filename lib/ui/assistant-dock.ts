"use client";

import { useSyncExternalStore } from "react";

const KEY = "assistant-dock-v1";

export type DockState = {
  /** When true, the floating button is hidden and a launcher lives in the nav. */
  docked: boolean;
  /** When true, the chat panel is open. */
  open: boolean;
  /** Button top-left position. -1 means "use default bottom-right". */
  x: number;
  y: number;
};

const DEFAULT: DockState = { docked: false, open: false, x: -1, y: -1 };

let memory: DockState = DEFAULT;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) memory = { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  loaded = true;
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* ignore */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function snapshot() {
  load();
  return memory;
}

export function useDock(): DockState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function setDocked(v: boolean) {
  load();
  memory = { ...memory, docked: v };
  persist();
  emit();
}

export function setOpen(v: boolean) {
  load();
  memory = { ...memory, open: v };
  persist();
  emit();
}

export function openAssistant() {
  load();
  memory = { ...memory, docked: false, open: true };
  persist();
  emit();
}

/** Bring the button back to the screen (without auto-opening the panel). */
export function undockAssistant() {
  load();
  memory = { ...memory, docked: false, open: false };
  persist();
  emit();
}

export function setPosition(x: number, y: number) {
  load();
  memory = { ...memory, x, y };
  persist();
  emit();
}
