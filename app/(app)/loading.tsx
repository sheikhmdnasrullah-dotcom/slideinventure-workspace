import { Skeleton } from "@/components/ui/skeleton"

// Route-group loading fallback: shown while a segment under app/(app)/* is
// server-rendering, for any route that doesn't define its own loading.tsx.
// Mirrors the shape most workspace pages settle into (toolbar + list) so
// there's no layout shift once real content swaps in.
export default function AppSegmentLoading() {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="h-9 w-full max-w-sm" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  )
}
