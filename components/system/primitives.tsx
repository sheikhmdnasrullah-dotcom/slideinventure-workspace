/**
 * SYSTEM — Blueprint Primitives
 * ---------------------------------------------------------------------------
 * Architectural framing primitives ported directly from SlideIn Venture:
 *   CornerBrackets — blueprint framing for relatively-positioned containers
 *   Ticks          — precision measurement tick marks along card edges
 */

import { cn } from "@/lib/utils";

export function CornerBrackets({
  size = 10,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const base = "absolute border-[var(--rule-strong)]";
  const s = { width: size, height: size };
  return (
    <span aria-hidden className={cn("pointer-events-none", className)}>
      <span className={cn(base, "left-0 top-0 border-l border-t")} style={s} />
      <span className={cn(base, "right-0 top-0 border-r border-t")} style={s} />
      <span className={cn(base, "bottom-0 left-0 border-b border-l")} style={s} />
      <span className={cn(base, "bottom-0 right-0 border-b border-r")} style={s} />
    </span>
  );
}

export function Ticks({
  count = 12,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-y-0 w-1.5", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="absolute h-px w-full bg-[var(--rule)]"
          style={{ top: `${((i + 1) / (count + 1)) * 100}%` }}
        />
      ))}
    </span>
  );
}
