"use client";

import * as React from "react";
import { CopilotPopup } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { Bot } from "lucide-react";

/**
 * The copilot's chat surface.
 *
 * The CopilotKit provider in the app layout only exposes the runtime; without a
 * chat component the registered actions and readables are never reachable by the
 * model. This popup is that surface, and it is the app's single floating
 * assistant. It sits bottom right, the conventional spot, and the agent status
 * indicator is offset above it so the two never overlap.
 */
function CopilotLauncher(props: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label="Open copilot"
      className="fixed right-4 bottom-4 z-50 flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-[transform,box-shadow] duration-150 hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.97] motion-reduce:transition-none"
    >
      <Bot className="size-5" />
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
        initial: "Ask a question, or ask the copilot to search, take a note, or run an agent.",
      }}
      Button={CopilotLauncher}
    />
  );
}
