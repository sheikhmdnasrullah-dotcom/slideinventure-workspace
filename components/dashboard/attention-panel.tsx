"use client";

import type { AttentionItem, NextBestAction } from "@/lib/dashboard/types";
import { Panel, PanelEmpty, PanelRow } from "@/components/dashboard/panel";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = {
  high: "bg-[var(--status-danger)]",
  medium: "bg-[var(--status-warn)]",
  low: "bg-[var(--status-info)]",
  good: "bg-[var(--status-live)]",
};

/**
 * Attention. Overdue, failed and unsynthesized items, ranked by the API.
 * Severity is a 6px dot rather than a tinted row: the row content is the signal,
 * the colour is only the ordering cue.
 */
export function AttentionPanel({ items = [] }: { items?: AttentionItem[] }) {
  return (
    <Panel title="Needs attention" meta={items.length > 0 ? `${items.length}` : undefined}>
      {items.length === 0 ? (
        <PanelEmpty>Nothing overdue or failed.</PanelEmpty>
      ) : (
        <div className="flex flex-col divide-y divide-rule">
          {items.map((item) => (
            <PanelRow
              key={item.id}
              href={item.href}
              title={item.title}
              meta={item.description}
              leading={
                <span
                  className={cn("size-1.5 shrink-0 rounded-full", DOT[item.severity] ?? DOT.low)}
                  aria-hidden
                />
              }
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

/**
 * Next up. The API derives these from concrete workspace state (an unsynthesized
 * upload, a research thread with no conclusion). The `reason` is rendered as the
 * supporting fact, not as advice.
 */
export function NextUpPanel({ actions = [] }: { actions?: NextBestAction[] }) {
  return (
    <Panel title="Next up" meta={actions.length > 0 ? `${actions.length}` : undefined}>
      {actions.length === 0 ? (
        <PanelEmpty>No open loops.</PanelEmpty>
      ) : (
        <div className="flex flex-col divide-y divide-rule">
          {actions.map((action) => (
            <PanelRow
              key={action.id}
              href={action.href}
              title={action.title}
              meta={action.reason}
              trailing={action.priority === "high" ? "Priority" : undefined}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
