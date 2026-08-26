import {
  BookOpen,
  Bot,
  Brain,
  Cable,
  FileText,
  GripVertical,
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
  | "notepad"
  | "brainstorm-sketch"
  | "terminal"
  | "useful-links"
  | "mail-apps"
  | "vault"
  | "settings"

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
  { id: "chat", label: "Chat", route: "/chat", icon: MessageSquare },
  { id: "agents", label: "Agents", route: "/agents", icon: Bot },
  { id: "todoist", label: "Todoist", route: "/todoist", icon: Sparkles },
  { id: "knowledge", label: "Knowledge", route: "/knowledge", icon: BookOpen },
  { id: "documents", label: "Documents", route: "/documents", icon: FileText },
  { id: "ai-venture", label: "AI Venture", route: "/ai-venture", icon: Rocket },
  { id: "notepad", label: "Notepad", route: "/notepad", icon: BookOpen },
  { id: "brainstorm-sketch", label: "Brainstorm Sketch", route: "/brainstorm-sketch", icon: Brain },
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
  { id: "settings", label: "Settings", route: "/settings", icon: Settings },
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

export function getOrderedSections(order: string[] | null | undefined) {
  const merged = mergeNavigationOrder(order)
  const byId = new Map(DASHBOARD_SECTIONS.map((section) => [section.id, section]))
  return merged.map((id) => byId.get(id)!).filter(Boolean)
}

export function isValidLandingPageRoute(route: string | null | undefined) {
  return !!route && LANDING_PAGE_ROUTES.has(route)
}

export const NAVIGATION_HANDLE_ICON = GripVertical
