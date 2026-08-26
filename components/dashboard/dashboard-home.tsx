import { SiteHeader } from "@/components/dashboard/site-header"
import { SectionCards } from "@/components/dashboard/v3/section-cards"
import { ChartAreaInteractive } from "@/components/dashboard/v3/chart-area-interactive"
import { DataTable, type ActivityItem } from "@/components/dashboard/v3/data-table"
import type { DashboardResponse, ActivityRow, ActivityStatus } from "@/lib/dashboard/types"
import { MotionCard, Stagger, StaggerItem } from "@/components/system/motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Brain,
  Beaker,
  Terminal,
  Users,
  BookOpen,
  Lightbulb,
  ArrowRight,
  ExternalLink,
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
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

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
      return "AI Venture"
    case "todoist":
      return "Todoist"
    case "knowledge":
      return "Knowledge"
    case "leads":
      return "Lead"
    default:
      return type.charAt(0).toUpperCase() + type.slice(1)
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
  }
  const Icon = iconMap[category] ?? FileCode2
  return <Icon className="size-3.5 text-muted-foreground" />
}

export async function DashboardHome() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/dashboard`,
    { cache: "no-store" }
  ).catch(() => null)

  const data: DashboardResponse | null = res?.ok
    ? ((await res.json()) as DashboardResponse)
    : null

  const tableItems: ActivityItem[] = (data?.activity ?? []).map(toDataTableItem)
  const activity = data?.activity ?? []
  const recentActivity = activity.slice(0, 8)
  const kpis = data?.kpis ?? []

  return (
    <>
      <SiteHeader crumbs={[{ label: "Dashboard" }]} />
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Command Center</h1>
            <p className="text-sm text-muted-foreground">
              Live workspace overview • Updated {data?.syncedAt ? new Date(data.syncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "just now"}
            </p>
          </div>
        </div>

        <div className="px-4 lg:px-6">
          <SectionCards kpis={kpis} />
        </div>

        <div className="px-4 lg:px-6">
          <ChartAreaInteractive data={data?.chart ?? []} />
        </div>

        <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
          <MotionCard className="@container/card col-span-full @5xl/main:col-span-2">
            <Card className="@container/card">
              <CardHeader>
                <CardTitle>Live Activity</CardTitle>
                <CardDescription>
                  Automatic activity from every module
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent activity. Start working in any module to see live updates here.</p>
                ) : (
                  <ScrollArea className="h-[320px] pr-4">
                    <div className="flex flex-col gap-3">
                      {recentActivity.map((item) => (
                        <MotionCard key={item.id} delay={0} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {categoryIcon(item.type)}
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <p className="text-sm font-medium leading-tight">{item.item}</p>
                                <p className="text-xs text-muted-foreground">
                                  {humanize(item.type)} • {item.source}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {statusBadge(item.status)}
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(item.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        </MotionCard>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </MotionCard>

          <MotionCard className="@container/card flex flex-col">
            <Card className="@container/card flex flex-1 flex-col">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Brain className="size-4 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">AI Venture</CardTitle>
                    <CardDescription>Recent research activity</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                {activity
                  .filter((a) => a.type === "ai_venture")
                  .slice(0, 5)
                  .map((item) => (
                    <MotionCard key={item.id} delay={0} className="rounded-lg border p-3">
                      <p className="text-sm font-medium leading-tight">{item.item}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </MotionCard>
                  )) ?? (
                  <p className="text-sm text-muted-foreground">No recent AI Venture activity.</p>
                )}
                <Button asChild variant="outline" size="sm" className="mt-auto">
                  <Link href="/ai-venture" className="gap-2">
                    Open AI Venture <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </MotionCard>

          <MotionCard className="@container/card flex flex-col">
            <Card className="@container/card flex flex-1 flex-col">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Terminal className="size-4 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">Terminal</CardTitle>
                    <CardDescription>Recent findings</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                {activity
                  .filter((a) => a.type === "terminal")
                  .slice(0, 5)
                  .map((item) => (
                    <MotionCard key={item.id} delay={0} className="rounded-lg border p-3">
                      <p className="text-sm font-medium leading-tight">{item.item}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </MotionCard>
                  )) ?? (
                  <p className="text-sm text-muted-foreground">No recent terminal activity.</p>
                )}
                <Button asChild variant="outline" size="sm" className="mt-auto">
                  <Link href="/terminal" className="gap-2">
                    Open Terminal <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </MotionCard>

          <MotionCard className="@container/card flex flex-col">
            <Card className="@container/card flex flex-1 flex-col">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BookOpen className="size-4 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">Knowledge</CardTitle>
                    <CardDescription>Recently updated</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                {activity
                  .filter((a) => a.type === "knowledge" || a.type === "notes")
                  .slice(0, 5)
                  .map((item) => (
                    <MotionCard key={item.id} delay={0} className="rounded-lg border p-3">
                      <p className="text-sm font-medium leading-tight">{item.item}</p>
                      <p className="text-xs text-muted-foreground">
                        {humanize(item.type)} • {new Date(item.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </MotionCard>
                  )) ?? (
                  <p className="text-sm text-muted-foreground">No recent knowledge activity.</p>
                )}
                <Button asChild variant="outline" size="sm" className="mt-auto">
                  <Link href="/knowledge" className="gap-2">
                    Open Knowledge <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </MotionCard>

          <MotionCard className="@container/card flex flex-col">
            <Card className="@container/card flex flex-1 flex-col">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">Leads</CardTitle>
                    <CardDescription>Active prospects</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                {activity
                  .filter((a) => a.type === "leads")
                  .slice(0, 5)
                  .map((item) => (
                    <MotionCard key={item.id} delay={0} className="rounded-lg border p-3">
                      <p className="text-sm font-medium leading-tight">{item.item}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </MotionCard>
                  )) ?? (
                  <p className="text-sm text-muted-foreground">No recent lead activity.</p>
                )}
                <Button asChild variant="outline" size="sm" className="mt-auto">
                  <Link href="/leads" className="gap-2">
                    Open Leads <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </MotionCard>

          <MotionCard className="@container/card flex flex-col">
            <Card className="@container/card flex flex-1 flex-col">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">Documents</CardTitle>
                    <CardDescription>Recently created</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                {activity
                  .filter((a) => a.type === "documents")
                  .slice(0, 5)
                  .map((item) => (
                    <MotionCard key={item.id} delay={0} className="rounded-lg border p-3">
                      <p className="text-sm font-medium leading-tight">{item.item}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </MotionCard>
                  )) ?? (
                  <p className="text-sm text-muted-foreground">No recent documents.</p>
                )}
                <Button asChild variant="outline" size="sm" className="mt-auto">
                  <Link href="/documents" className="gap-2">
                    Open Documents <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </MotionCard>

          <MotionCard className="@container/card flex flex-col">
            <Card className="@container/card flex flex-1 flex-col">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">Chat</CardTitle>
                    <CardDescription>Recent conversations</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                {activity
                  .filter((a) => a.type === "chat")
                  .slice(0, 5)
                  .map((item) => (
                    <MotionCard key={item.id} delay={0} className="rounded-lg border p-3">
                      <p className="text-sm font-medium leading-tight">{item.item}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </MotionCard>
                  )) ?? (
                  <p className="text-sm text-muted-foreground">No recent chat activity.</p>
                )}
                <Button asChild variant="outline" size="sm" className="mt-auto">
                  <Link href="/chat" className="gap-2">
                    Open Chat <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </MotionCard>
        </div>

        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle>All Activity</CardTitle>
              <CardDescription>
                Unified timeline from all modules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable data={tableItems} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
