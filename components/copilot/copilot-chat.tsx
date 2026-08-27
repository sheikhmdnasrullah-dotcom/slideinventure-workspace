"use client";

import * as React from "react";
import { CopilotPopup } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { Bot } from "lucide-react";

/**
 * The copilot's own chat surface. The CopilotKit provider in the app layout
 * only exposes the runtime; without a chat component the registered actions
 * and readables are never reachable by the model. This popup is the surface
 * that actually drives them.
 *
 * Its launcher sits bottom-left so it does not collide with the existing
 * bottom-right FloatingAiChat widget.
 */
function CopilotLauncher(props: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label="Open copilot"
      className="fixed bottom-4 left-4 z-50 flex size-12 items-center justify-center rounded-full border bg-card text-foreground shadow-lg transition-transform hover:scale-105"
    >
      <Bot className="size-6" />
    </button>
  );
}

export function CopilotChat() {
  return (
    <CopilotPopup
      clickOutsideToClose
      hitEscapeToClose
      labels={{
        title: "Copilot",
        initial: "Ask the copilot to search, take notes, or run an agent.",
      }}
      Button={CopilotLauncher}
    />
  );
}
