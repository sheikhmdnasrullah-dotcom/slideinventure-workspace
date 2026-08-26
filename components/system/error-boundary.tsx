"use client"

import * as React from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  children: React.ReactNode
  /** Short label for what broke, e.g. "Knowledge", "AI Venture". */
  label: string
  className?: string
}

type State = { error: Error | null }

// Error boundaries must be class components — React has no hook equivalent.
// Use this to wrap one workspace subtree (a sidebar app, a heavy panel) so a
// render error there degrades to an inline message instead of taking out
// everything else mounted alongside it (the app shell's route-level
// app/(app)/error.tsx already covers whole-page crashes; this is for the
// finer-grained case of one widget inside a page that still has other
// working widgets next to it).
export class SectionErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`${this.props.label} crashed:`, error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className={`flex h-full min-h-[240px] flex-1 flex-col items-center justify-center gap-3 p-8 text-center ${this.props.className ?? ""}`}>
          <div className="flex size-9 items-center justify-center rounded-full bg-[var(--status-danger)]/10 text-[var(--status-danger)]">
            <AlertTriangle className="size-4" />
          </div>
          <p className="text-sm font-medium text-[color:var(--ink-strong)]">{this.props.label} hit a problem</p>
          <p className="max-w-sm text-xs text-[color:var(--ink-muted)]">
            The rest of the dashboard is still working. This won&apos;t affect your saved data.
          </p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={this.reset}>
            <RotateCcw className="size-3.5" /> Try again
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
