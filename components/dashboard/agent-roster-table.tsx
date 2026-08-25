"use client";

import { useMemo, useState } from "react";
import { DataTable, FilterBar, Badge, type Column } from "@/components/system";
import { AgentRunSheet } from "@/components/dashboard/agent-run-sheet";
import type { RosterAgent } from "@/lib/agents/roster";

const DIVISION_LABELS: Record<string, string> = {
  academic: "Academic",
  design: "Design",
  engineering: "Engineering",
  finance: "Finance",
  "game-development": "Game Development",
  gis: "GIS",
  healthcare: "Healthcare",
  marketing: "Marketing",
  "paid-media": "Paid Media",
  product: "Product",
  "project-management": "Project Management",
  sales: "Sales",
  security: "Security",
  "spatial-computing": "Spatial Computing",
  specialized: "Specialized",
  strategy: "Strategy",
  support: "Support",
  testing: "Testing",
};

export function AgentRosterTable({
  agents,
  divisions,
}: {
  agents: RosterAgent[];
  divisions: string[];
}) {
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("all");
  const [active, setActive] = useState<RosterAgent | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => {
      if (division !== "all" && a.division !== division) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q)
      );
    });
  }, [agents, query, division]);

  const columns: Column<RosterAgent>[] = [
    {
      key: "name",
      header: "Agent",
      sortable: true,
      render: (a) => (
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{a.emoji ?? "🤖"}</span>
          <span className="font-body text-sm font-medium text-ink-strong">{a.name}</span>
        </div>
      ),
    },
    {
      key: "division",
      header: "Division",
      sortable: true,
      render: (a) => (
        <Badge variant="outline" className="text-[10px] whitespace-nowrap">
          {DIVISION_LABELS[a.division] ?? a.division}
          {a.team ? ` · ${a.team}` : ""}
        </Badge>
      ),
    },
    {
      key: "description",
      header: "Specialty",
      render: (a) => (
        <span className="font-body text-sm text-ink-muted line-clamp-2">{a.description}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <FilterBar>
        <FilterBar.Search
          value={query}
          onChange={setQuery}
          placeholder="Search agents…"
        />
        <FilterBar.Select
          value={division}
          onChange={setDivision}
          ariaLabel="Division"
          options={[
            { value: "all", label: `All divisions (${agents.length})` },
            ...divisions.map((d) => ({
              value: d,
              label: `${DIVISION_LABELS[d] ?? d} (${agents.filter((a) => a.division === d).length})`,
            })),
          ]}
        />
        {(query || division !== "all") && (
          <FilterBar.Clear
            onClick={() => {
              setQuery("");
              setDivision("all");
            }}
          />
        )}
      </FilterBar>
      <DataTable
        columns={columns}
        data={filtered}
        rowKey="slug"
        onRowClick={(a) => setActive(a)}
        empty={{ title: "No agents match", description: "Try a different search or division." }}
      />
      <AgentRunSheet agent={active} onOpenChange={(open) => !open && setActive(null)} />
    </div>
  );
}
