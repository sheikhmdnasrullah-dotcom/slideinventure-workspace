"use client";

import { usePathname } from "next/navigation";
import { useCopilotReadable } from "@copilotkit/react-core";
import { FloatingAiChat } from "@/components/chat/floating-ai-chat";

export function AgentCopilot() {
  const pathname = usePathname();

  // Gives the copilot real context about where the user currently is in the
  // dashboard, so it can reason about "this page" instead of nothing at all.
  useCopilotReadable({
    description: "The current page (route) the user is viewing in the dashboard app",
    value: { pathname },
  });

  return <FloatingAiChat />;
}
