import type { DeployTarget } from "./deployed-agent-store";

/**
 * Live context providers let each droppable section (Notepad, Research Lab,
 * Files, etc.) expose its *current* plain-text content to the floating
 * deployed agent. When an agent is dropped onto a section we read from here so
 * the agent is handed the real content instead of just the section title.
 *
 * A provider returns `null` when there is nothing meaningful to read yet.
 */
export type LiveContext = { title: string; content: string } | null;

type Provider = () => LiveContext;

const providers = new Map<DeployTarget, Provider>();

export function registerContextProvider(target: DeployTarget, provider: Provider) {
  if (target) providers.set(target, provider);
}

export function unregisterContextProvider(target: DeployTarget) {
  providers.delete(target);
}

export function getLiveContext(target: DeployTarget | null | undefined): LiveContext {
  if (!target) return null;
  const provider = providers.get(target);
  if (!provider) return null;
  try {
    return provider();
  } catch {
    return null;
  }
}
