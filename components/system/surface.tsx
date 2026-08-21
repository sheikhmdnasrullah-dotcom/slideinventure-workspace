import { cn } from "@/lib/utils";

/**
 * Surface — the non-card container. The brief explicitly forbids putting every
 * piece of information inside a rounded rectangle ("over-carding"). A Surface
 * is a sectioned container: it can hold a list divided by hairlines, a table,
 * or a metric row — without boxing each child in its own card.
 *
 *   flat    inherits tone bg; no border. For content that sits on the section.
 *   inset   a well — surface-2 with a hairline rule. Grouping without boxes.
 *   raised  surface with a stronger rule. The closest thing to a Card without
 *           being one: a single panel, not a rounded rectangle per datum.
 *
 * Card (shadcn) is still available for genuinely raised containers (a dialog
 * body, a popover). Surface is the default; Card is the exception.
 */
export type SurfaceVariant = "flat" | "inset" | "raised";

const VARIANT_CLASS: Record<SurfaceVariant, string> = {
  flat: "bg-transparent",
  inset: "bg-[var(--surface-2)] ring-1 ring-rule rounded-md",
  raised: "bg-[var(--surface)] ring-1 ring-rule-strong rounded-md shadow-raised",
};

export function Surface({
  variant = "flat",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { variant?: SurfaceVariant }) {
  return (
    <div
      data-slot="surface"
      data-variant={variant}
      className={cn("px-4 py-3", VARIANT_CLASS[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Divider — a hairline rule between items. For dividing rows inside a Surface
 * without boxing each row. Reads --rule, so it is correct on both themes.
 */
export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-rule", className)} />;
}
