import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

/**
 * EmptyState — the disciplined empty surface. An icon (or a label eyebrow),
 * a short title, one line of description, an optional CTA. NOT a giant
 * illustration of a person wondering where their data went.
 */
export function EmptyState({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: { label: React.ReactNode; onClick: () => void };
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn("flex flex-col items-center justify-center gap-2 py-12 text-center", className)}
    >
      {eyebrow && <span className="font-label text-ink-faint">{eyebrow}</span>}
      <p className="font-display-soft text-ink-strong">{title}</p>
      {description && (
        <p className="max-w-sm font-body text-sm text-ink-muted">{description}</p>
      )}
      {action && (
        <Button size="sm" variant="outline" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}

/**
 * LoadingState — a skeleton matching the row/grid shape it stands in for.
 * The default renders N rows of a typical list (an avatar-less line + a
 * muted line), which is the common case across the console.
 */
export function LoadingState({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      data-slot="loading-state"
      className={cn("flex flex-col divide-y divide-rule", className)}
      role="status"
      aria-live="polite"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-16 shrink-0" />
          <Skeleton className="ml-auto h-4 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * ErrorState — the "degrade gracefully" surface. Today every route silently
 * catches Supabase errors and renders empty data (see api/dashboard, api/knowledge/search).
 * This primitive makes the failure VISIBLE so an operator can tell "nothing
 * matched" from "the DB is down" — the distinction the audit flagged as missing.
 */
export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      data-slot="error-state"
      className={cn(
        "flex flex-col gap-2 rounded-md border border-[color-mix(in_oklch,var(--status-danger)_30%,transparent)] bg-[color-mix(in_oklch,var(--status-danger)_6%,transparent)] px-4 py-3",
        className
      )}
      role="alert"
    >
      <p className="font-body text-sm text-ink-strong">{title}</p>
      {description && (
        <p className="font-body text-sm text-ink-muted">{description}</p>
      )}
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="mt-1 w-fit"
        >
          Retry
        </Button>
      )}
    </div>
  );
}
