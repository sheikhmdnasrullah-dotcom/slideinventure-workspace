import { SiteHeader } from "@/components/dashboard/site-header"
import { DashboardMetrics } from "@/components/dashboard/dashboard-metrics"
import { LiveActivity, QuickActions } from "@/components/dashboard/live-activity"
import { Section, SectionRule, Surface } from "@/components/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, type ActivityItem } from "@/components/dashboard/v3/data-table"
import type { DashboardResponse, ActivityRow, ActivityStatus } from "@/lib/dashboard/types"
import {
  Beaker,
  Terminal,
  Users,
  Lightbulb,
  FileText,
  MessageSquare,
  CheckCircle2,
  Loader,
  CircleDashed,
  Sparkles,
  FileCode2,
  LibraryBig,
  Rocket,
  NotebookPen,
  Link2,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import dynamic from "next/dynamic"
import { headers } from "next/headers"

const DataTableLazy = dynamic(
  () => import("@/components/dashboard/v3/data-table").then((m) => m.DataTable),
  { loading: () => <div className="h-64 animate-pulse rounded-lg border" /> }
)

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

function humanize(value: string): string {
  switch (value) {
    case "cold_email":
      return "Cold Email"
    case "documents":
      return "Document"
    case "notes":
      return "Note"
    case "terminal":
      return "Terminal"
    case "links":
      return "Link"
    case "chat":
      return "Chat"
    case "ai_venture":
      return "Concepts"
    case "todoist":
      return "Todoist"
    case "knowledge":
      return "Knowledge"
    case "leads":
      return "Lead"
    case "brainstorm":
      return "Brainstorm"
    case "ideas":
      return "Idea Map"
    case "research":
      return "Research"
    default:
      return value.charAt(0).toUpperCase() + value.slice(1)
  }
}

function statusBadge(status: ActivityStatus) {
  const map: Record<ActivityStatus, { icon: typeof CheckCircle2; className: string }> = {
    completed: { icon: CheckCircle2, className: "text-emerald-600" },
    active: { icon: Loader, className: "text-sky-600" },
    running: { icon: Loader, className: "text-sky-600 animate-spin" },
    failed: { icon: CircleDashed, className: "text-rose-600" },
    ai_inferred: { icon: Sparkles, className: "text-amber-600" },
    proposed: { icon: CircleDashed, className: "text-muted-foreground" },
  }
  const { icon: Icon, className } = map[status] ?? map.proposed
  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <Icon className="size-3" />
      {humanize(status)}
    </Badge>
  )
}

const SECTION_HREF: Record<string, string> = {
  notes: "/notepad",
  documents: "/documents",
  knowledge: "/knowledge",
  terminal: "/terminal",
  leads: "/leads",
  chat: "/chat",
  ai_venture: "/concepts",
  concepts: "/concepts",
  brainstorm: "/brainstorm-sketch",
  links: "/useful-links",
  vault: "/vault",
  integrations: "/integrations",
  agents: "/agents",
  todoist: "/todoist",
  research: "/research",
  ideas: "/ideas",
}

const SECTION_LABEL: Record<string, string> = {
  notes: "Notes",
  documents: "Documents",
  knowledge: "Knowledge",
  terminal: "Terminal",
  leads: "Leads",
  chat: "Chat",
  ai_venture: "Concepts",
  concepts: "Concepts",
  brainstorm: "Brainstorm",
  links: "Links",
  vault: "Vault",
  integrations: "Integrations",
  agents: "Agents",
  todoist: "Todoist",
  research: "Research",
  ideas: "Idea Maps",
}

function hrefForRow(row: ActivityRow): string {
  return SECTION_HREF[row.category ?? row.source] ?? "/activity"
}

function categoryIcon(category: string) {
  const iconMap: Record<string, typeof FileText> = {
    documents: FileText,
    notes: NotebookPen,
    terminal: Terminal,
    links: Link2,
    chat: MessageSquare,
    ai_venture: Rocket,
    todoist: CheckCircle2,
    knowledge: LibraryBig,
    leads: Users,
    research: Beaker,
    concepts: Sparkles,
    brainstorm: Lightbulb,
    ideas: Lightbulb,
  }
  const Icon = iconMap[category] ?? FileCode2
  return <Icon className="size-3.5 text-muted-foreground" />
}

export async function DashboardHome() {
  // Forward the incoming session cookie so the internal API call authenticates
  // (a raw server fetch would 401 and render an empty dashboard).
  const cookie = (await headers()).get("cookie") ?? ""
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/dashboard`,
    { cache: "no-store", headers: cookie ? { cookie } : undefined }
  ).catch(() => null)

  const data: DashboardResponse | null = res?.ok
    ? ((await res.json()) as DashboardResponse)
    : null

  const activity = data?.activity ?? []
  const tableItems: ActivityItem[] = activity.map(toDataTableItem)

  return (
    <>
      <SiteHeader crumbs={[{ label: "Dashboard" }]} />
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Command Center</h1>
            <p className="text-sm text-muted-foreground">
              Live workspace overview
              {data?.syncedAt
                ? ` • Updated ${new Date(data.syncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </p>
          </div>
        </div>

        <div className="px-4 lg:px-6">
          <DashboardMetrics initial={data} />
        </div>

        <div className="px-4 lg:px-6">
          <QuickActions />
        </div>

        <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 lg:grid-cols-2">
          <LiveActivity />
          <RecentWork activity={activity} />
        </div>

        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle>All Activity</CardTitle>
              <CardDescription>Unified timeline from all modules</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTableLazy data={tableItems} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

function RecentWork({ activity }: { activity: ActivityRow[] }) {
  if (activity.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent work</CardTitle>
          <CardDescription>From every section</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No work recorded yet. Notes, documents, boards, research and idea maps appear here as you create them.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button render={<Link href="/notepad" />} variant="outline" size="sm">
              New note <ArrowRight className="size-3.5" />
            </Button>
            <Button render={<Link href="/documents" />} variant="outline" size="sm">
              Upload document <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const bySection = new Map<string, { href: string; items: ActivityRow[] }>()
  for (const row of activity) {
    const key = row.category ?? row.source
    const label = SECTION_LABEL[key] ?? humanize(row.type)
    if (!bySection.has(label)) bySection.set(label, { href: hrefForRow(row), items: [] })
    bySection.get(label)!.items.push(row)
  }

  const sections = Array.from(bySection.entries()).map(([label, v]) => ({
    label,
    href: v.href,
    items: v.items.slice(0, 3),
  }))

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">Recent work</CardTitle>
        <CardDescription>From every section</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {sections.map((section) => (
          <div key={section.label} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {section.label}
              </span>
              <Button render={<Link href={section.href} />} variant="ghost" size="xs">
                View
              </Button>
            </div>
            {section.items.map((item) => (
              <Link
                key={item.id}
                href={section.href}
                className="flex items-center gap-2 rounded-md border p-2 text-sm transition-colors hover:bg-muted"
              >
                {categoryIcon(item.category ?? item.source)}
                <span className="flex-1 truncate">{item.item}</span>
                <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                  {new Date(item.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </Link>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
