"use client"

import { useEffect } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { GlossTile } from "@/components/system/gloss-tile"

// Next.js route-group error boundary: catches a render error anywhere under
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
    <div className="flex h-full min-h-[320px] flex-1 flex-col items-center justify-center p-8">
      <Card className="w-full max-w-[440px] items-center text-center">
        <CardContent className="items-center">
          <GlossTile icon="inbox" size={64} float={false} />
          <p className="text-base font-semibold text-ink-strong">This section hit a problem</p>
          <p className="max-w-[360px] text-sm leading-[22px] text-ink-muted">
            The rest of the dashboard is unaffected. Try again, or come back to it later. Your data hasn&apos;t been touched.
          </p>
          <Button size="sm" variant="outline" className="mt-1 gap-1.5" onClick={() => reset()}>
            <RotateCcw className="size-4" /> Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
