import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * StatusBadge: the one tokenized status indicator. Folds the per-component
 * STATUS_STYLES + TREND_STYLES maps (scattered through activity-table.tsx,
 * kpi-card.tsx, execution-panel.tsx) into one source of truth.
 *
 *   tone      the semantic state: live | info | warn | danger | neutral | flame
 *   dot       render a pulsing dot before the label (running/live indicators)
 *   label     the text. If omitted, the tone name is title-cased.
 *
 * Tones map to the theme-tokenized --status-* colors, so the same badge reads
 * correctly on day and night without a `dark:` variant. Tints are done with
 * inline color-mix (Tailwind has no `bg-color-mix` utility and alpha-modding
 * a token via `/10` doesn't reach the named status tokens).
 */
export type StatusTone =
  | "live"
  | "info"
  | "warn"
  | "danger"
  | "neutral"
  | "flame";

const TONE_STYLE: Record<StatusTone, { bg: string; color: string; dot: string }> = {
  live: {
    bg: "var(--status-live-bg)",
    color: "var(--status-live)",
    dot: "var(--status-live)",
  },
  info: {
    bg: "var(--status-info-bg)",
    color: "var(--status-info)",
    dot: "var(--status-info)",
  },
  warn: {
    bg: "var(--status-warn-bg)",
    color: "var(--status-warn)",
    dot: "var(--status-warn)",
  },
  danger: {
    bg: "var(--status-danger-bg)",
    color: "var(--status-danger)",
    dot: "var(--status-danger)",
  },
  neutral: {
    bg: "var(--status-neutral-bg)",
    color: "var(--status-neutral)",
    dot: "var(--status-neutral)",
  },
  flame: {
    bg: "var(--accent-wash)",
    color: "var(--text-accent)",
    dot: "var(--accent-vivid)",
  },
};

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusBadge({
  tone,
  label,
  dot = true,
  className,
}: {
  tone: StatusTone;
  label?: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  const s = TONE_STYLE[tone];
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", className)}
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            tone === "live" && "animate-pulse"
          )}
          style={{ backgroundColor: s.dot }}
          aria-hidden
        />
      )}
      {label ?? titleCase(tone)}
    </Badge>
  );
}

/**
 * TrendBadge: the small up/down/flat indicator on a Metric. Maps to the
 * status palette: up = live, down = danger, flat = neutral. The arrow glyph
 * is the clearest directional indicator at small sizes.
 */
export type TrendDirection = "up" | "down" | "flat";

const TREND_TONE: Record<TrendDirection, StatusTone> = {
  up: "live",
  down: "danger",
  flat: "neutral",
};

const TREND_GLYPH: Record<TrendDirection, string> = {
  up: "↑",
  down: "↓",
  flat: "",
};

export function TrendBadge({
  direction,
  label,
  className,
}: {
  direction: TrendDirection;
  label: React.ReactNode;
  className?: string;
}) {
  return (
    <StatusBadge
      tone={TREND_TONE[direction]}
      className={cn("tabular-nums", className)}
      label={
        <span className="inline-flex items-center gap-1">
          <span aria-hidden>{TREND_GLYPH[direction]}</span>
          {label}
        </span>
      }
    />
  );
}
