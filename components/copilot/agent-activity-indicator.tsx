"use client";

import * as React from "react";
import { useLiveEvents } from "@/components/providers/event-stream";
import { agentStatusLabel } from "@/lib/agui/protocol";
import { MotionDiv, Ease, Duration } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * A compact, calm indicator that appears only while an agent run is in flight,
 * driven by the live agent event stream. Shows the agent name and current
 * status (never chain-of-thought). Hides itself once the run reaches a terminal
 * state, lingering briefly so the user sees the outcome.
 */
export function AgentActivityIndicator() {
  const { events } = useLiveEvents({ types: ["agent."] });
  const latest = events[0] ?? null;
  const [show, setShow] = React.useState(false);

  const agentName =
    (latest?.metadata?.agent as string | undefined) ?? latest?.title ?? "Agent";
  const statusText = latest ? agentStatusLabel(latest.type, latest.metadata) : "";

  const terminal =
    latest?.type === "agent.completed" || latest?.type === "agent.failed";

  React.useEffect(() => {
    if (!latest) return;
    setShow(true);
    if (terminal) {
      const t = setTimeout(() => setShow(false), 4000);
      return () => clearTimeout(t);
    }
  }, [latest, terminal]);

  const running = !terminal;

  return (
    <MotionDiv
      initial={false}
      animate={{ opacity: show ? 1 : 0, y: show ? 0 : 8 }}
      transition={{ duration: Duration.fast, ease: Ease.expo }}
      aria-hidden={!show}
      className={cn(
        "pointer-events-none fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs shadow-lg",
        !show && "opacity-0"
      )}
    >
      {running && (
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-primary" />
      )}
      <span className="font-medium text-foreground">{agentName}</span>
      <span className="text-muted-foreground">{statusText}</span>
    </MotionDiv>
  );
}
