import Link from "next/link";
import { TrendBadge, type TrendDirection } from "@/components/system/status-badge";
import { cn } from "@/lib/utils";

/**
 * Metric — the disciplined replacement for KpiCard. A status/statement row,
 * not a metric wall. Each Metric is: label · value · delta · provenance.
 *
 *   label       what this is (mono eyebrow)
 *   value       the number — set with .font-value (mono, semibold, tabular)
 *   direction   optional trend — renders a TrendBadge (up/down/flat + caption)
 *   delta       the trend caption (e.g. "from task log")
 *   provenance  the muted subline: where this number came from. Carries the
 *               brief's "evidence-first" principle onto a number itself.
 *   href        optional link to a filtered view that explains the number
 *
 * NO Card wrapper — a Metric is rendered on a Surface (or its own grid cell),
 * which is what stops the page reading as "a 4-up wall of rounded rectangles".
 */
export function Metric({
  label,
  value,
  direction,
  delta,
  provenance,
  href,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  direction?: TrendDirection;
  delta?: React.ReactNode;
  provenance?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const valueEl = (
    <span className="font-value text-2xl text-ink-strong">{value}</span>
  );
  return (
    <div
      data-slot="metric"
      className={cn("flex flex-col gap-1.5 py-2", className)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-label text-ink-faint">{label}</span>
        {direction && delta && (
          <TrendBadge direction={direction} label={delta} />
        )}
      </div>
      {href ? (
        <Link href={href} className="font-value text-2xl text-ink-strong transition-colors hover:text-[var(--text-accent)]">
          {value}
        </Link>
      ) : (
        valueEl
      )}
      {provenance && (
        <span className="font-body-tight text-xs text-ink-muted">
          {provenance}
        </span>
      )}
    </div>
  );
}

/**
 * MetricRow — the grid that holds a set of Metrics without boxing each in a
 * Card. A 1/2/4-col responsive row separated by vertical hairlines instead
 * of rounded rectangles. This is the construction the audit called for in
 * place of "stack of KPI cards".
 */
export function MetricRow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="metric-row"
      className={cn(
        "grid grid-cols-1 divide-rule sm:grid-cols-2 sm:divide-x xl:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * MetricCell — the cell inside a MetricRow. Pads so the divide-x reads as a
 * hairline between values, not as a border boxing the value.
 */
export function MetricCell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="metric-cell"
      className={cn("px-4 py-1 first:pl-0 sm:px-5 xl:px-6", className)}
    >
      {children}
    </div>
  );
}
