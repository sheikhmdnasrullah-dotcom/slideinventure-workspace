import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Panel: the single container the dashboard is built from.
 *
 * Deliberately quiet — one hairline border, one flat fill, no shadow stack, no
 * tinted washes, no icon per heading. Every panel on the dashboard uses this so
 * hierarchy comes from typography and spacing rather than from decoration.
 *
 * Headings are sentence case. Panels do not explain themselves in a footer;
 * if a number needs provenance it is stated as data, not as prose.
 */
export function Panel({
  title,
  meta,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-slot="panel"
      className={cn(
        "flex flex-col rounded-lg border border-rule bg-[var(--surface)]",
        className
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
        <h2 className="font-body-tight text-sm font-medium text-ink-strong">
          {title}
        </h2>
        {action ?? (meta ? <span className="font-label text-xs text-ink-faint">{meta}</span> : null)}
      </header>
      <div className={cn("flex flex-1 flex-col p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** A label/value pair. Value is mono + tabular so columns align across panels. */
export function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <span className="font-label text-xs text-ink-faint">{label}</span>
      <span className="font-mono text-xl font-semibold tabular-nums text-ink-strong">
        {value}
      </span>
      {hint ? <span className="font-body text-xs text-ink-muted">{hint}</span> : null}
    </>
  );

  if (!href) {
    return <div className="flex flex-col gap-1">{inner}</div>;
  }

  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-sm transition-colors hover:text-[var(--text-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ring)]"
    >
      {inner}
    </Link>
  );
}

/** Empty state: one line of fact, optionally one line of what makes it fill. */
export function PanelEmpty({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-1 py-2">
      <p className="font-body text-sm text-ink-muted">{children}</p>
      {hint ? <p className="font-body text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}

/** A tappable list row. The dashboard's only repeated interactive unit. */
export function PanelRow({
  href,
  title,
  meta,
  trailing,
  leading,
}: {
  href: string;
  title: string;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group -mx-1.5 flex items-center gap-3 rounded-md px-1.5 py-2 transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent-ring)]"
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body-tight text-sm text-ink-strong">
          {title}
        </span>
        {meta ? (
          <span className="block truncate font-body text-xs text-ink-muted">{meta}</span>
        ) : null}
      </span>
      {trailing ? (
        <span className="shrink-0 font-label text-xs text-ink-faint">{trailing}</span>
      ) : null}
    </Link>
  );
}
