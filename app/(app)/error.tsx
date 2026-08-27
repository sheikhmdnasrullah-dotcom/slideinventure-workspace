"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

// Next.js route-group error boundary — catches a render error anywhere under
// app/(app)/* that doesn't have its own error.tsx. This keeps a crash in one
// workspace section from taking down the whole dashboard: the sidebar/shell
// in the parent layout stays mounted, only this segment's content is
// replaced. `reset()` re-renders the segment without a full page reload.
export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Workspace section crashed:", error)
  }, [error])

  return (
    <div className="flex h-full min-h-[320px] flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-[var(--status-danger)]/10 text-[var(--status-danger)]">
        <AlertTriangle className="size-5" />
      </div>
      <p className="text-sm font-medium text-[color:var(--ink-strong)]">This section hit a problem</p>
      <p className="max-w-sm text-sm text-[color:var(--ink-muted)]">
        The rest of the dashboard is unaffected. Try again, or come back to it later. Your data hasn&apos;t been touched.
      </p>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => reset()}>
        <RotateCcw className="size-3.5" /> Try again
      </Button>
    </div>
  )
}
