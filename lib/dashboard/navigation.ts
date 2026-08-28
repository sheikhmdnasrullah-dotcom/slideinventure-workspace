import {
  BookOpen,
  Bot,
  Beaker,
  Brain,
  Cable,
  FileText,
  GripVertical,
  Network,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Rocket,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Terminal,
  Vault,
  Workflow,
  Video,
  BarChart3,
  Component,
  type LucideIcon,
} from "lucide-react"

export type DashboardSectionId =
  | "dashboard"
  | "integrations"
  | "leads"
  | "chat"
  | "agents"
  | "todoist"
  | "knowledge"
  | "documents"
  | "ai-venture"
  | "research-lab"
  | "notepad"
  | "brainstorm-sketch"
  | "ideas"
  | "terminal"
  | "useful-links"
  | "mail-apps"
  | "vault"
  | "settings"
  | "email-crawler"
  | "agent-canvas"
  | "analytics"
  | "ai-chat"
  | "ui-kit"
  | "youtube-email"
  | "csv-discovery"

export type DashboardSectionChild = {
  id: string
  label: string
  route: string
  icon?: LucideIcon
  external?: boolean
}

export type DashboardSection = {
  id: DashboardSectionId
  label: string
  route: string
  icon: LucideIcon
  children?: DashboardSectionChild[]
}

export const DASHBOARD_SECTIONS: DashboardSection[] = [
  { id: "dashboard", label: "Dashboard", route: "/dashboard", icon: LayoutDashboard },
  { id: "integrations", label: "Integrations", route: "/integrations", icon: Cable },
  {
    id: "leads",
    label: "Leads",
    route: "/leads",
    icon: FileText,
    children: [
      { id: "leads-all", label: "All Leads", route: "/leads" },
      { id: "leads-verify", label: "Verify Leads", route: "/leads/verify", icon: ShieldCheck },
    ],
  },
  { id: "chat", label: "Look Up", route: "/chat", icon: MessageSquare },
  {
    id: "agents",
    label: "Agents",
    route: "/agents",
    icon: Bot,
    children: [
      { id: "agents-roster", label: "Agent Roster", route: "/agents" },
      { id: "agents-youtube-email", label: "YouTube Email Agent", route: "/agents/youtube-email", icon: Video },
    ],
  },
  { id: "todoist", label: "Todoist", route: "/todoist", icon: Sparkles },
  { id: "knowledge", label: "Knowledge", route: "/knowledge", icon: BookOpen },
  { id: "documents", label: "Documents", route: "/documents", icon: FileText },
  { id: "ai-venture", label: "AI Venture", route: "/concepts", icon: Rocket },
  { id: "research-lab", label: "Research Lab", route: "/research-lab", icon: Beaker },
  { id: "notepad", label: "Notepad", route: "/notepad", icon: BookOpen },
  { id: "brainstorm-sketch", label: "Brainstorm", route: "/brainstorm-sketch", icon: Brain },
  { id: "ideas", label: "Ideas", route: "/ideas", icon: Network },
  { id: "terminal", label: "Terminal", route: "/terminal", icon: Terminal },
  { id: "useful-links", label: "Useful Links", route: "/useful-links", icon: Send },
  {
    id: "mail-apps",
    label: "Mail Apps",
    route: "/apps",
    icon: Mail,
    children: [
      { id: "mailgo", label: "Mailgo", route: "https://admin.tanim.tech", icon: Mail, external: true },
      { id: "sogo-mail", label: "SOGo mail", route: "https://mail.nasrullahtanim.me/admin", icon: Mail, external: true },
    ],
  },
  { id: "vault", label: "Vault", route: "/vault", icon: Vault },
  {
    id: "settings",
    label: "Settings",
    route: "/settings",
    icon: Settings,
    children: [
      { id: "settings-ui-kit", label: "UI Kit (shadcn/ui)", route: "/ui-kit", icon: Component },
      { id: "settings-ai-chat", label: "AI SDK Chat", route: "/ai-chat", icon: MessageSquare },
    ],
  },
  {
    id: "email-crawler",
    label: "Email Crawler",
    route: "/email-crawler",
    icon: Mail,
    children: [
      { id: "email-crawler-run", label: "Find emails", route: "/email-crawler" },
      { id: "email-crawler-verify", label: "Verify Leads", route: "/leads/verify", icon: ShieldCheck },
    ],
  },
  {
    id: "csv-discovery",
    label: "Lead Discovery",
    route: "/csv-discovery",
    icon: Network,
  },
  {
    id: "agent-canvas",
    label: "Agent Canvas",
    route: "/agent-canvas",
    icon: Workflow,
    children: [
      { id: "agent-canvas-run", label: "Pipeline", route: "/agent-canvas" },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    route: "/analytics",
    icon: BarChart3,
    children: [
      { id: "analytics-bento", label: "Live Metrics", route: "/analytics" },
    ],
  },
]

export const DEFAULT_NAVIGATION_ORDER = DASHBOARD_SECTIONS.map((section) => section.id)
export const NAVIGATION_SECTION_IDS = new Set(DEFAULT_NAVIGATION_ORDER)
export const LANDING_PAGE_ROUTES = new Set(DASHBOARD_SECTIONS.map((section) => section.route))

export function mergeNavigationOrder(order: string[] | null | undefined): DashboardSectionId[] {
  const next: DashboardSectionId[] = []
  const seen = new Set<DashboardSectionId>()

  for (const rawId of order ?? []) {
    if (!NAVIGATION_SECTION_IDS.has(rawId as DashboardSectionId)) continue
    const id = rawId as DashboardSectionId
    if (seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }

  for (const id of DEFAULT_NAVIGATION_ORDER) {
    if (seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }

  return next
}

export function getOrderedSections(
  order: string[] | null | undefined,
  labels?: Record<string, string> | null
) {
  const merged = mergeNavigationOrder(order)
  const byId = new Map(DASHBOARD_SECTIONS.map((section) => [section.id, section]))
  return merged
    .map((id) => {
      const section = byId.get(id)
      if (!section) return null
      const customLabel = labels?.[id]
      return customLabel ? { ...section, label: customLabel } : section
    })
    .filter((section): section is DashboardSection => Boolean(section))
}

export function getSectionLabel(
  id: DashboardSectionId,
  labels?: Record<string, string> | null
): string {
  if (labels?.[id]) return labels[id]
  return DASHBOARD_SECTIONS.find((section) => section.id === id)?.label ?? id
}

export function isValidLandingPageRoute(route: string | null | undefined) {
  return !!route && LANDING_PAGE_ROUTES.has(route)
}

export const NAVIGATION_HANDLE_ICON = GripVertical
