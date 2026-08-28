"use client"

import { DataTable, StatusBadge, type Column } from "@/components/system"

export type AgentHistoryRow = {
  id: string
  task_type: string
  command: string | null
  status: string
  started_at: string
  duration: number | null
}

function runStatusTone(status: string): "live" | "danger" | "warn" | "neutral" {
  if (status === "completed") return "live"
  if (status === "failed") return "danger"
  if (status === "running") return "warn"
  return "neutral"
}

// react-table column defs carry render closures, which cannot cross the
// server-to-client prop boundary (only the `data` array with plain values can).
// This whole table lives on the client so the column defs are constructed here,
// never passed in from the server page.
const columns: Column<AgentHistoryRow>[] = [
  {
    key: "task_type",
    header: "Type",
    sortable: true,
    render: (row) => <span className="font-label text-ink-strong">{row.task_type}</span>,
  },
  {
    key: "command",
    header: "Command",
    render: (row) => (
      <span className="block max-w-xs truncate font-mono text-xs text-ink-muted">{row.command ?? ""}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (row) => (
      <StatusBadge tone={runStatusTone(row.status)} dot={row.status === "running"} label={row.status} />
    ),
  },
  {
    key: "started_at",
    header: "Started",
    sortable: true,
    sortAccessor: (row) => new Date(row.started_at).getTime(),
    align: "right",
    render: (row) => (
      <span className="font-label tabular-nums text-ink-muted">
        {new Date(row.started_at).toLocaleTimeString()}
      </span>
    ),
  },
  {
    key: "duration",
    header: "Duration",
    sortable: true,
    align: "right",
    render: (row) => (
      <span className="font-label tabular-nums text-ink-muted">
        {row.duration !== null ? `${row.duration}s` : ""}
      </span>
    ),
  },
]

export function AgentHistoryTable({ data }: { data: AgentHistoryRow[] }) {
  return (
    <DataTable<AgentHistoryRow>
      data={data}
      columns={columns}
      empty={{ title: "No runs yet", description: "Completed and failed agent runs will appear here." }}
    />
  )
}
