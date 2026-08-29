"use client";

import { useSyncExternalStore } from "react";
import { blockNoteToPlainText } from "@/lib/retrieval/blocknote-text";

export type DeployableAgent = {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  strategy?: string;
  category?: "research" | "email" | "crawler" | "lead" | "general" | string;
  /** Where this agent runs. "mastra" routes chat/run to the self-hosted server. */
  runtime?: "mastra" | "claude";
};

export type NoteContext = {
  id: string;
  title: string;
  content?: string;
};

export type DeployTarget =
  | "notepad"
  | "brainstorm"
  | "files"
  | "research"
  | "query"
  | "useful-links"
  | "screen"
  | "workspace"
  | null;

export type DeployedAgentState = {
  isOpen: boolean;
  viewMode: "circle" | "expanded";
  agent: DeployableAgent | null;
  position: { x: number; y: number };
  target: DeployTarget;
  noteContext: NoteContext | null;
  /** Plain-text content of the section the agent is deployed into (the "context of contexts"). */
  contextText: string | null;
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
  contextText: null,
  messages: [],
  isThinking: false,
};

let store: DeployedAgentState = { ...DEFAULT_STATE };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function deployAgent(
  agent: DeployableAgent,
  initialPos?: { x: number; y: number },
  targetContext?: { target?: DeployTarget; id?: string; title?: string }
) {
  const x =
    initialPos?.x ??
    (typeof window !== "undefined" ? Math.max(80, window.innerWidth / 2 - 30) : 300);
  const y =
    initialPos?.y ??
    (typeof window !== "undefined" ? Math.max(100, window.innerHeight / 3) : 200);

  const target = targetContext?.target ?? "screen";
  const noteContext = targetContext?.id
    ? { id: targetContext.id, title: targetContext.title || "Workspace" }
    : null;

  store = {
    ...store,
    isOpen: true,
    viewMode: "circle",
    agent,
    position: { x, y },
    target,
    noteContext,
    contextText: null,
    messages: [
      {
        role: "assistant",
        content: `I am ${agent.name}. Drag me onto your Notepad, Brainstorm, or anywhere you want me deployed, or tap to open my controls!`,
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
    contextText: note.content ? blockNoteToPlainText(note.content) : null,
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

export function attachToTarget(
  target: DeployTarget,
  context?: { id?: string; title?: string; content?: string } | null
) {
  const title =
    context?.title || (target ? target.charAt(0).toUpperCase() + target.slice(1) : "Workspace");
  store = {
    ...store,
    target,
    noteContext: { id: context?.id || "", title, content: context?.content },
    contextText: context?.content || null,
    viewMode: "expanded",
    messages: [
      ...store.messages,
      {
        role: "assistant",
        content: context?.content
          ? `Deployed into ${title} with its full context loaded. I've read everything — let's start researching.`
          : `Deployed into ${title}. Ready to assist you here!`,
      },
    ],
  };
  emit();
}

export function updateNoteContext(noteContext: NoteContext | null) {
  store = { ...store, noteContext };
  emit();
}

export function setDeployedContext(contextText: string | null) {
  store = { ...store, contextText };
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

export function resetAgentConversation() {
  if (!store.agent) return;
  store = {
    ...store,
    messages: [
      {
        role: "assistant",
        content: `Conversation reset. I am ${store.agent.name}. How can I help you?`,
      },
    ],
  };
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

/** Synchronous read of the latest state, for use outside React render cycles. */
export function getDeployedAgent(): DeployedAgentState {
  return store;
}

export function useDeployedAgent() {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_STATE);
}
