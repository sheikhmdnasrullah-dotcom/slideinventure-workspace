"use client";

import { Component, type ReactNode } from "react";

// Isolates a single integration card (or the whole list) so a render error in
// one of them shows a localized message instead of taking down the entire
// integrations section via the route-level error boundary. See 2026-08-29
// integration hardening.
export class IntegrationErrorBoundary extends Component<
  { children: ReactNode; label?: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Integration subsection crashed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-md border border-dashed border-rule bg-[var(--surface-2)] p-4 text-xs text-foreground/50">
          {this.props.label ?? "This integration"} hit a problem loading. Refresh the page to
          try again.
        </div>
      );
    }
    return this.props.children;
  }
}
