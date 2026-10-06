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
  Megaphone,
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
  FileSearch,
  type LucideIcon,
} from "lucide-react"

export type DashboardSectionId =
  | "dashboard"
  | "leads"
  | "chat"
  | "cold-outreach"
  | "agents"
  | "agent-canvas"
  | "lead-research"
  | "todoist"
  | "knowledge"
  | "documents"
  | "analytics"
  | "activity"
  | "integrations"
  | "settings"
  | "notepad"
  | "terminal"
  | "vault"
  | "useful-links"

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
  category?: "core" | "workforce" | "knowledge" | "operations"
  badge?: string
  children?: DashboardSectionChild[]
}

export const DASHBOARD_SECTIONS: DashboardSection[] = [
  { id: "dashboard", label: "Command Center", route: "/dashboard", icon: LayoutDashboard, category: "core" },
  { id: "leads", label: "Opportunities", route: "/leads", icon: FileText, category: "core", badge: "Live" },
  { id: "chat", label: "Conversations", route: "/chat", icon: MessageSquare, category: "core" },
  { id: "cold-outreach", label: "Missions & Outreach", route: "/cold-outreach", icon: Rocket, category: "core" },
  { id: "todoist", label: "Tasks & Meetings", route: "/todoist", icon: Sparkles, category: "core" },

  { id: "agents", label: "AI Workforce", route: "/agents", icon: Bot, category: "workforce", badge: "8 Active" },
  { id: "agent-canvas", label: "Agent Canvas", route: "/agent-canvas", icon: Workflow, category: "workforce" },
  { id: "lead-research", label: "Prospect Research", route: "/lead-research", icon: FileSearch, category: "workforce" },

  { id: "knowledge", label: "Company Memory", route: "/knowledge", icon: BookOpen, category: "knowledge" },
  { id: "documents", label: "Documents", route: "/documents", icon: FileText, category: "knowledge" },
  { id: "notepad", label: "Scratchpad & Notes", route: "/notepad", icon: BookOpen, category: "knowledge" },
  { id: "vault", label: "Credentials Vault", route: "/vault", icon: Vault, category: "knowledge" },

  { id: "analytics", label: "Acquisition Health", route: "/analytics", icon: BarChart3, category: "operations", badge: "94%" },
  { id: "activity", label: "Activity & Logs", route: "/activity", icon: Terminal, category: "operations" },
  { id: "integrations", label: "Integrations & Email", route: "/integrations", icon: Cable, category: "operations" },
  { id: "settings", label: "Workspace Settings", route: "/settings", icon: Settings, category: "operations" },
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
