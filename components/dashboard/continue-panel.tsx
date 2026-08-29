"use client";

import type { ContinueItem } from "@/lib/dashboard/types";
import { Panel, PanelEmpty, PanelRow } from "@/components/dashboard/panel";

/**
 * Continue. The most recently touched artifacts, each linking back to the exact
 * item. Ordering comes from the API (updatedAt desc); this component only renders.
 */
export function ContinuePanel({ items = [] }: { items?: ContinueItem[] }) {
  return (
    <Panel title="Continue" meta={items.length > 0 ? `${items.length}` : undefined}>
      {items.length === 0 ? (
        <PanelEmpty hint="Notes, boards and research you touch will appear here.">
          Nothing recent to resume.
        </PanelEmpty>
      ) : (
        <div className="flex flex-col divide-y divide-rule">
          {items.map((item) => (
            <PanelRow
              key={item.id}
              href={item.href}
              title={item.title}
              meta={item.lastOpenedLabel}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
