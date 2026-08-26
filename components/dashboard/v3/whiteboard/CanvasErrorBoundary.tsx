"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react"

interface Props {
  children: React.ReactNode
  onBack?: () => void
  onRetry?: () => void
}

interface State {
  hasError: boolean
  message?: string
}

export class CanvasErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "An unexpected error occurred.",
    }
  }

  componentDidCatch(error: unknown) {
    // Surface the error for debugging without taking down the whole app.
    console.error("Brainstorm canvas error:", error)
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: undefined })
    this.props.onRetry?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-medium">We couldn’t load this board.</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Something went wrong while rendering the canvas. Your other work is safe.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={this.handleRetry}>
              <RotateCcw className="mr-2 size-4" />
              Retry
            </Button>
            {this.props.onBack && (
              <Button onClick={this.props.onBack}>
                <ArrowLeft className="mr-2 size-4" />
                Back to Boards
              </Button>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
