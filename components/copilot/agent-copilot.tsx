"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useCopilotReadable } from "@copilotkit/react-core";
import { CopilotActions } from "@/components/copilot/copilot-actions";
import { CopilotChat } from "@/components/copilot/copilot-chat";
import { AgentActivityIndicator } from "@/components/copilot/agent-activity-indicator";
import { useLiveEvents } from "@/components/providers/event-stream";
import { agentStatusLabel } from "@/lib/agui/protocol";
import { sectionForPathname } from "@/lib/copilot/section-context";

export function AgentCopilot() {
  const pathname = usePathname();
  const section = sectionForPathname(pathname);

  // Where the user is, and how to interpret "here" / "this section". The model
  // should prefer the current section for scoped requests and search globally
  // on the dashboard.
  useCopilotReadable({
    description:
      "The current dashboard section the user is viewing. Prefer this section when the user says 'here' or 'this section'; search globally when on the dashboard. searchScope is 'section' or 'global'; sources lists the result types relevant here.",
    value: section,
  });

  const { events: agentEvents } = useLiveEvents({ types: ["agent."] });

  // Reduced, execution-status-only view of recent agent runs: no
  // chain-of-thought and no raw payloads, just agent name, status, and time.
  const recentAgents = React.useMemo(() => {
    const byRun = new Map<string, { agent: string; status: string; at: string }>();
    for (const e of agentEvents) {
      const runId =
        (e.metadata?.runId as string | undefined) ?? e.entityId ?? e.id;
      const agent =
        (e.metadata?.agent as string | undefined) ?? e.title ?? "Agent";
      byRun.set(runId, {
        agent,
        status: agentStatusLabel(e.type, e.metadata),
        at: e.timestamp,
      });
    }
    return Array.from(byRun.values()).slice(0, 8);
  }, [agentEvents]);

  useCopilotReadable({
    description:
      "Recent agent run activity across the workspace. Shows only execution status (agent name, current status, timestamp), not reasoning. Use to tell the user what automation is running or just finished.",
    value: recentAgents,
  });

  // One assistant surface, not two. The CopilotKit popup is the only floating
  // chat: it is the surface that can actually act on the workspace (search,
  // create, run an agent) and it already knows the current section. A second
  // bubble that could only talk made the app feel like two products.
  return (
    <>
      <CopilotActions />
      <AgentActivityIndicator />
      <CopilotChat />
    </>
  );
}
