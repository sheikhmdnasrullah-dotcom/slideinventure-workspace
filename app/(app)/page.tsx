import { requireUser } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/dashboard/site-header";
import { SectionCards } from "@/components/dashboard/v3/section-cards";
import { ChartAreaInteractive } from "@/components/dashboard/v3/chart-area-interactive";
import { DataTable, type ActivityItem } from "@/components/dashboard/v3/data-table";
import type { DashboardResponse, ActivityRow, ActivityStatus } from "@/lib/dashboard/types";

function toDataTableItem(row: ActivityRow): ActivityItem {
  const status = mapStatus(row.status)
  return {
    id: row.id,
    header: row.item,
    type: humanize(row.type),
    status,
    target: row.source,
    limit: new Date(row.updatedAt).toLocaleDateString(),
    reviewer: row.source,
    source: row.source,
    updatedAt: row.updatedAt,
  }
}

function mapStatus(status: ActivityStatus): ActivityItem["status"] {
  if (status === "completed" || status === "active") return "Done"
  if (status === "running") return "In Progress"
  if (status === "failed") return "Failed"
  if (status === "proposed") return "Not Started"
  return "Not Started"
}

function humanize(type: ActivityRow["type"]): string {
  switch (type) {
    case "cold_email":
      return "Cold Email"
    default:
      return type.charAt(0).toUpperCase() + type.slice(1)
  }
}

export default async function DashboardPage() {
  await requireUser();

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/dashboard`,
    { cache: "no-store" }
  ).catch(() => null)

  const data: DashboardResponse | null = res?.ok
    ? ((await res.json()) as DashboardResponse)
    : null

  const tableItems: ActivityItem[] = (data?.activity ?? []).map(toDataTableItem)

  return (
    <>
      <SiteHeader crumbs={[{ label: "Dashboard" }]} />
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <SectionCards kpis={data?.kpis ?? []} />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive data={data?.chart ?? []} />
       </div>
        <DataTable data={tableItems} />
     </div>
    </>
  )
}
