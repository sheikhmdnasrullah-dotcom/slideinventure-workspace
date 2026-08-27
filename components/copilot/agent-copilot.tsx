"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

export function AgentCopilot() {
  return (
    <CopilotKit runtimeUrl="/api/copilot">
      <CopilotPopup
        instructions="You are the operations copilot for an autonomous agentic dashboard. Help the user orchestrate agents (browser crawling, CAPTCHA solving, lead verification), explain runs, and answer questions about the pipeline. Be concise."
        labels={{
          title: "Agent Copilot",
          initial: "How can I help you orchestrate your agents?",
        }}
      />
    </CopilotKit>
  );
}
