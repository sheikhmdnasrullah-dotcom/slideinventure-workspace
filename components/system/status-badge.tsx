import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * StatusBadge — the one tokenized status indicator. Folds the per-component
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

const TONE_STYLE: Record<
  StatusTone,
  { border: string; bg: string; color: string }
> = {
  live: {
    border: "color-mix(in oklch, var(--status-live) 30%, transparent)",
    bg: "color-mix(in oklch, var(--status-live) 10%, transparent)",
    color: "var(--status-live)",
  },
  info: {
    border: "color-mix(in oklch, var(--status-info) 30%, transparent)",
    bg: "color-mix(in oklch, var(--status-info) 10%, transparent)",
    color: "var(--status-info)",
  },
  warn: {
    border: "color-mix(in oklch, var(--status-warn) 30%, transparent)",
    bg: "color-mix(in oklch, var(--status-warn) 10%, transparent)",
    color: "var(--status-warn)",
  },
  danger: {
    border: "color-mix(in oklch, var(--status-danger) 30%, transparent)",
    bg: "color-mix(in oklch, var(--status-danger) 10%, transparent)",
    color: "var(--status-danger)",
  },
  neutral: {
    border: "var(--rule-strong)",
    bg: "var(--surface-2)",
    color: "var(--text-muted)",
  },
  flame: {
    border: "var(--accent-ring)",
    bg: "var(--accent-wash)",
    color: "var(--text-accent)",
  },
};

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusBadge({
  tone,
  label,
  dot = false,
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
      className={cn("gap-1 font-label normal-case", className)}
      style={{ borderColor: s.border, backgroundColor: s.bg, color: s.color }}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full bg-current",
            tone === "live" && "animate-pulse"
          )}
          aria-hidden
        />
      )}
      {label ?? titleCase(tone)}
    </Badge>
  );
}

/**
 * TrendBadge — the small up/down/flat indicator on a Metric. Maps to the
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
  flat: "–",
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
