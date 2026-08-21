"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ArrowUpDown } from "lucide-react";
import { EmptyState } from "@/components/system/states";

/**
 * DataTable — the generic typed table. Generalizes ActivityTable's sortable
 * header + status badge + mono dates pattern into one reusable surface. This
 * is the density reference for the console: every list that can be a table
 * should be a table, not a stack of Cards.
 *
 *   columns   the column spec: key (data field), header, render?, sortable?,
 *             align, className
 *   data       the rows
 *   rowKey     the unique-key field (default "id")
 *   onRowClick optional
 *   empty      the EmptyState title/description when data is []
 *   loading    render skeleton rows instead
 *   pageSize   if set, paginate client-side; default = no pagination
 *
 * Sort state is internal and resets when `data` identity changes.
 */
export type Column<T> = {
  key: keyof T | string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  sortAccessor?: (row: T) => string | number;
  align?: "left" | "right";
  className?: string;
  headerClassName?: string;
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey = "id",
  onRowClick,
  empty,
  loading = false,
  pageSize,
  className,
}: {
  columns: Column<T>[];
  data: T[];
  rowKey?: keyof T | string;
  onRowClick?: (row: T) => void;
  empty?: { title: ReactNode; description?: ReactNode; action?: { label: ReactNode; onClick: () => void } };
  loading?: boolean;
  pageSize?: number;
  className?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => String(c.key) === sortKey);
    const accessor = col?.sortAccessor ?? ((r: T) => r[col?.key as keyof T] as string | number | undefined);
    const rows = [...data];
    rows.sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [data, sortKey, sortDir, columns]);

  const visible = useMemo(() => {
    if (!pageSize || pageSize >= sorted.length) return sorted;
    return sorted.slice(0, pageSize);
  }, [sorted, pageSize]);

  function toggleSort(col: Column<T>) {
    if (!col.sortable) return;
    const key = String(col.key);
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (loading) {
    return (
      <div className={cn("divide-y divide-rule", className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5">
            {columns.map((c, j) => (
              <div
                key={j}
                className="h-4 flex-1 animate-pulse rounded bg-[var(--surface-2)]"
                style={{ maxWidth: 200 }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        eyebrow={empty ? undefined : "No rows"}
        title={empty?.title ?? "Nothing here yet"}
        description={empty?.description}
        action={empty?.action}
        className={cn("py-10", className)}
      />
    );
  }

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((col) => {
            const key = String(col.key);
            const active = key === sortKey;
            return (
              <TableHead
                key={key}
                className={cn(
                  "h-8 px-2 align-middle",
                  col.align === "right" && "text-right",
                  col.headerClassName
                )}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(col)}
                    className={cn(
                      "inline-flex items-center gap-1 font-label normal-case text-ink-faint transition-colors hover:text-ink-strong",
                      col.align === "right" && "flex-row-reverse",
                      active && "text-ink-strong"
                    )}
                  >
                    {col.header}
                    <ArrowUpDown
                      className={cn("size-3", active && sortDir === "asc" && "rotate-180", "transition-transform")}
                    />
                  </button>
                ) : (
                  <span className="font-label normal-case text-ink-faint">
                    {col.header}
                  </span>
                )}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {visible.map((row) => (
          <TableRow
            key={String(row[rowKey as keyof T])}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(onRowClick && "cursor-pointer")}
          >
            {columns.map((col) => {
              const key = String(col.key);
              const cell = col.render ? col.render(row) : (row[col.key as keyof T] as ReactNode);
              return (
                <TableCell
                  key={key}
                  className={cn(
                    "px-2 py-2.5 align-middle",
                    col.align === "right" && "text-right",
                    col.className
                  )}
                >
                  {cell}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
