"use client";

import { cn } from "@/lib/utils";

/**
 * FilterBar — a tight row of filter controls. Not a Card. Not a Dialog. Just
 * a horizontal row that keeps the search input + type/status/tag/date filters
 * + a clear button on one line (wrapping on narrow viewports).
 *
 *   <FilterBar>
 *     <FilterBar.Search value onChange placeholder />
 *     <FilterBar.Select value onChange options />
 *     <FilterBar.Chips value onChange options />   multi-select
 *     <FilterBar.Clear onClick />
 *   </FilterBar>
 *
 * Subcomponents are exposed via FilterBar.* so a page composes only the filter
 * controls it needs. All controls read the semantic tokens — no per-filter
 * custom styling.
 */
export function FilterBar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="filter-bar"
      className={cn(
        "flex flex-wrap items-center gap-2 py-2",
        className
      )}
    >
      {children}
    </div>
  );
}

FilterBar.Search = function FilterBarSearch({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "h-8 w-full max-w-64 rounded-sm border border-rule-strong bg-[var(--surface)] px-3 font-body text-sm text-ink-default outline-none transition-colors placeholder:text-ink-faint focus:border-[var(--text-accent)]",
        className
      )}
    />
  );
};

FilterBar.Select = function FilterBarSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 rounded-sm border border-rule-strong bg-[var(--surface)] pl-2 pr-6 font-body text-sm text-ink-default outline-none transition-colors focus:border-[var(--text-accent)]",
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
};

FilterBar.Chips = function FilterBarChips({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap gap-1 rounded-sm border border-rule p-0.5", className)}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? null : o.value)}
            className={cn(
              "rounded-xs px-2 py-1 font-label normal-case transition-colors",
              active
                ? "bg-[var(--surface-2)] text-ink-strong"
                : "text-ink-faint hover:text-ink-strong"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

FilterBar.Clear = function FilterBarClear({
  onClick,
  label = "Clear",
  className,
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "font-label normal-case text-ink-faint transition-colors hover:text-ink-strong",
        className
      )}
    >
      {label}
    </button>
  );
};

/** ControlledButton — a plain button that fits the bar's visual register. */
FilterBar.Button = function FilterBarButton({
  active = false,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 px-3 font-body text-sm transition-colors",
        active
          ? "bg-[var(--accent-wash)] text-[var(--text-accent)]"
          : "text-ink-muted hover:text-ink-strong",
        className
      )}
    >
      {children}
    </button>
  );
};
