"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  BookOpen,
  Cable,
  FileText,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  Send,
  Settings,
  Sparkles,
  Terminal,
  Users,
  type LucideIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

import { NavMain } from "@/components/dashboard/v3/nav-main"
import { NavSecondary } from "@/components/dashboard/v3/nav-secondary"
import { NavUser } from "@/components/dashboard/v3/nav-user"
import { NavDocuments } from "@/components/dashboard/v3/nav-documents"

function useIsActive() {
  const pathname = usePathname()
  return (url: string) => {
    if (url === "/") return pathname === "/"
    const seg = url.split("/")[1] ?? ""
    const pathSeg = pathname.split("/")[1] ?? ""
    return seg !== "" && seg === pathSeg
  }
}

type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  isActive?: boolean
  external?: boolean
}

const NAV_MAIN: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Mail", url: "/mail", icon: Inbox },
  { title: "Activity", url: "/activity", icon: Activity },
  { title: "Agents", url: "/agents", icon: Terminal },
]

const NAV_DOCUMENTS: NavItem[] = [
  { title: "Knowledge", url: "/knowledge", icon: BookOpen },
  { title: "Outreach", url: "/cold-outreach", icon: Send },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Strategy", url: "/strategy", icon: Sparkles },
  { title: "Research", url: "/research", icon: BookOpen },
  { title: "Insights", url: "/insights", icon: Lightbulb },
  { title: "Chat", url: "/chat", icon: MessageSquare },
  { title: "Notion", url: "/notion", icon: FileText },
  { title: "Miro", url: "/miro", icon: Activity },
  { title: "Todoist", url: "/todoist", icon: Sparkles },
  { title: "Vault", url: "/vault", icon: FileText },
]

const NAV_SECONDARY: NavItem[] = [
  { title: "Integrations", url: "/automations", icon: Cable },
  { title: "Terminal", url: "/terminal", icon: Terminal },
  { title: "Apps", url: "/apps", icon: Cable },
  { title: "Useful Links", url: "/useful-links", icon: Send },
  {
    title: "Admin",
    url: "https://admin.tanim.tech",
    icon: Settings,
    external: true,
  },
]

export function AppSidebar({
  userEmail,
  ...props
}: React.ComponentProps<typeof Sidebar> & { userEmail: string }) {
  const isActive = useIsActive()

  const navMainItems = NAV_MAIN.map((item) => ({
    title: item.title,
    url: item.url,
    icon: item.icon,
  }))

  const navDocumentsItems = NAV_DOCUMENTS.map((item) => ({
    name: item.title,
    url: item.url,
    icon: item.icon,
  }))

  const navSecondaryItems = NAV_SECONDARY.map((item) => ({
    title: item.title,
    url: item.url,
    icon: item.icon,
  }))

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-foreground font-mono text-xs font-semibold text-background">
                SV
             </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-base font-semibold">SlideIn Venture</span>
                <span className="truncate text-xs text-muted-foreground">Ops console</span>
             </div>
           </SidebarMenuButton>
         </SidebarMenuItem>
       </SidebarMenu>
     </SidebarHeader>

      <SidebarContent>
        <NavMain items={navMainItems} />
        <NavDocuments items={navDocumentsItems} />
        <NavSecondary items={navSecondaryItems} className="mt-auto" />
     </SidebarContent>

      <SidebarFooter>
        <NavUser
          user={{
            name: userEmail.split("@")[0] || "Founder",
            email: userEmail,
            avatar: "",
          }}
        />
     </SidebarFooter>
      <SidebarRail />
   </Sidebar>
  )
}
