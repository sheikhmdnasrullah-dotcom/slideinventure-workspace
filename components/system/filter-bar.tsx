"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * FilterBar: a tight row of filter controls. Not a Card. Not a Dialog. Just
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
 * controls it needs. All controls read the semantic tokens: no per-filter
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
  placeholder = "Search",
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
        "h-11 w-full max-w-64 rounded-md border border-rule-strong bg-surface px-3.5 text-sm text-ink-strong outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-ink-faint hover:border-[var(--input-focus-border)] focus-visible:border-[var(--input-focus-border)] focus-visible:shadow-[0_0_0_4px_var(--input-focus-ring)]",
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
        "h-11 rounded-md border border-rule-strong bg-surface pr-8 pl-3.5 text-sm text-ink-strong outline-none transition-[border-color,box-shadow] duration-[120ms] hover:border-[var(--input-focus-border)] focus-visible:border-[var(--input-focus-border)] focus-visible:shadow-[0_0_0_4px_var(--input-focus-ring)]",
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
      className={cn("flex flex-wrap items-center gap-1 rounded-pill bg-status-neutral-bg p-1", className)}
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
              "flex h-8 items-center rounded-pill px-3.5 text-[13px] font-medium transition-all duration-[220ms",
              active
                ? "bg-surface text-ink-strong shadow-raised"
                : "text-ink-muted hover:text-ink-strong"
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
        "font-label text-ink-muted transition-colors hover:text-ink-strong",
        className
      )}
    >
      {label}
    </button>
  );
};

/** ControlledButton: a plain button that fits the bar's visual register. */
FilterBar.Button = function FilterBarButton({
  active = false,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick: () => void;
  // Optional so it can also be used as a `render` target (e.g. inside
  // `<DropdownMenuTrigger render={<FilterBar.Button .../>}>`), where the
  // trigger's own children are merged onto this element instead of passed here.
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center rounded-pill px-4 text-[13px] font-medium transition-colors",
        active
          ? "bg-flame-wash text-ink-strong"
          : "text-ink-muted hover:bg-hover-tint hover:text-ink-strong",
        className
      )}
    >
      {children}
    </button>
  );
};
