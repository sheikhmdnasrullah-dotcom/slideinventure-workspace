"use client";

import { useSyncExternalStore } from "react";

export type DeployableAgent = {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  strategy?: string;
  category?: "research" | "email" | "crawler" | "lead" | "general";
};

export type NoteContext = {
  id: string;
  title: string;
  content?: string;
};

export type DeployedAgentState = {
  isOpen: boolean;
  viewMode: "circle" | "expanded";
  agent: DeployableAgent | null;
  position: { x: number; y: number };
  target: "notepad" | "screen" | "workspace" | null;
  noteContext: NoteContext | null;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  isThinking: boolean;
};

const DEFAULT_STATE: DeployedAgentState = {
  isOpen: false,
  viewMode: "circle",
  agent: null,
  position: { x: 300, y: 180 },
  target: null,
  noteContext: null,
  messages: [],
  isThinking: false,
};

let store: DeployedAgentState = { ...DEFAULT_STATE };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function deployAgent(agent: DeployableAgent, initialPos?: { x: number; y: number }) {
  const x = initialPos?.x ?? (typeof window !== "undefined" ? Math.max(80, window.innerWidth / 2 - 30) : 300);
  const y = initialPos?.y ?? (typeof window !== "undefined" ? Math.max(100, window.innerHeight / 3) : 200);

  store = {
    ...store,
    isOpen: true,
    viewMode: "circle",
    agent,
    position: { x, y },
    target: "screen",
    messages: [
      {
        role: "assistant",
        content: `I am ${agent.name}. Drag me onto your Notepad or anywhere you want me deployed, or tap to open my controls!`,
      },
    ],
  };
  emit();
}

export function deployAgentToNotepad(agent: DeployableAgent, note: NoteContext) {
  store = {
    ...store,
    isOpen: true,
    viewMode: "expanded",
    agent,
    target: "notepad",
    noteContext: note,
    messages: [
      {
        role: "assistant",
        content: `Deployed to note "${note.title || "Untitled"}". I'm ready to research, summarize, critique, or draft content directly into this note!`,
      },
    ],
  };
  emit();
}

export function setDeployPosition(x: number, y: number) {
  store = { ...store, position: { x, y } };
  emit();
}

export function setDeployViewMode(mode: "circle" | "expanded") {
  store = { ...store, viewMode: mode };
  emit();
}

export function toggleDeployViewMode() {
  store = { ...store, viewMode: store.viewMode === "circle" ? "expanded" : "circle" };
  emit();
}

export function attachToTarget(target: "notepad" | "screen" | "workspace", noteContext?: NoteContext | null) {
  store = {
    ...store,
    target,
    noteContext: noteContext ?? store.noteContext,
    viewMode: "expanded",
  };
  emit();
}

export function updateNoteContext(noteContext: NoteContext | null) {
  store = { ...store, noteContext };
  emit();
}

export function dockAgentToNavbar() {
  store = {
    ...store,
    isOpen: false,
    viewMode: "circle",
    target: null,
  };
  emit();
}

export function closeDeployedAgent() {
  store = { ...DEFAULT_STATE };
  emit();
}

export function addAgentMessage(message: { role: "user" | "assistant"; content: string }) {
  store = { ...store, messages: [...store.messages, message] };
  emit();
}

export function setAgentThinking(isThinking: boolean) {
  store = { ...store, isThinking };
  emit();
}

export function clearAgentMessages() {
  store = { ...store, messages: [] };
  emit();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot() {
  return store;
}

export function useDeployedAgent() {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_STATE);
}
