import { cn } from "@/lib/utils";

/**
 * Section — a band of the page. Adapted from the marketing site's tone system
 * (design-system.md) for a console: three tones, no theme axis.
 *
 *   base    the page's own value (transparent — inherits --page-fill)
 *   inset   a well: --surface-2 with a hairline border (the non-card container)
 *   anchor  the signature band: a deeper value that anchors the page
 *
 * A console is denser than a marketing page, so the rhythm is tighter: padding
 * is py-8, not py-44. The point is the same — a page is composed of bands, not
 * one continuous surface, and the rhythm is what reads as "designed".
 *
 * `seam` draws a 1px optical hairline at the top join. `bleed` runs a short
 * gradient above so an anchor band emerges rather than starts.
 */
export type SectionTone = "base" | "inset" | "anchor";

const TONE_CLASS: Record<SectionTone, string> = {
  base: "bg-transparent",
  inset: "bg-[var(--surface-2)]",
  anchor: "bg-[var(--surface)]",
};

export function Section({
  tone = "base",
  seam = false,
  bleed = false,
  className,
  children,
  ...props
}: React.ComponentProps<"section"> & {
  tone?: SectionTone;
  seam?: boolean;
  bleed?: boolean;
}) {
  return (
    <section
      data-slot="section"
      data-tone={tone}
      className={cn(
        "relative isolate py-8",
        TONE_CLASS[tone],
        seam && "seam-top",
        bleed && "bleed-in",
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}

/**
 * SectionRule — the "NN — Label" + hairline + coordinate row from
 * design-system.md's System primitives. A label that sits on a rule,
 * with an optional right-side coordinate.
 */
export function SectionRule({
  index,
  label,
  coordinate,
  className,
}: {
  index?: React.ReactNode;
  label: React.ReactNode;
  coordinate?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="section-rule"
      className={cn(
        "flex items-center gap-3 pb-4 text-ink-faint",
        className
      )}
    >
      <span className="font-label whitespace-nowrap">
        {index != null && <span className="tabular-nums">{index} — </span>}
        {label}
      </span>
      <span className="h-px flex-1 bg-rule" />
      {coordinate && (
        <span className="font-label whitespace-nowrap tabular-nums">
          {coordinate}
        </span>
      )}
    </div>
  );
}
