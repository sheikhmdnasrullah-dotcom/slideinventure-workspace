"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny external store for the command menu's open/closed state. No new
 * dependency: useSyncExternalStore is React 19 native, and the store is small
 * enough that a full state library would be scaffolding.
 *
 * The sidebar and the header ⌘K trigger both need to open the menu without
 * prop-drilling through the layout, so a module-level store is the honest
 * choice. Two actions only: open(), close(). The menu itself owns its query
 * state internally — this is only the open/close signal.
 */

type State = { open: boolean };
let state: State = { open: false };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const commandMenuStore = {
  open() {
    if (state.open) return;
    state = { open: true };
    emit();
  },
  close() {
    if (!state.open) return;
    state = { open: false };
    emit();
  },
  toggle() {
    state = { open: !state.open };
    emit();
  },
  getSnapshot: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useCommandMenu<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(commandMenuStore.subscribe, () =>
    selector(commandMenuStore.getSnapshot())
  );
}
