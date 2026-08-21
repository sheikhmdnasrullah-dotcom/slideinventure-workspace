import { cn } from "@/lib/utils";

/**
 * PageHeader — the standard top-of-page header. Replaces per-page hand-rolled
 * muted-uppercase headers with one disciplined component.
 *
 *   eyebrow  mono label above the title (a section coordinate: "Knowledge Base")
 *   title    the page name (set with .font-display-soft, not a giant display)
 *   meta     right-aligned metadata (counts, last-synced, a chip)
 *   actions  right-aligned controls (sync, filter toggle)
 *
 * Tight by design — an ops console header is a coordinate, not a billboard.
 */
export function PageHeader({
  eyebrow,
  title,
  meta,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-2 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && <span className="font-label text-ink-faint">{eyebrow}</span>}
        <h1 className="font-display-soft text-lg text-ink-strong">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        {meta && <span className="font-label text-ink-faint">{meta}</span>}
        {actions}
      </div>
    </header>
  );
}
