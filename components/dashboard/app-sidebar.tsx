"use client"

import {
  BookOpen,
  Cable,
  FileText,
  Inbox,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Send,
  Settings,
  Sparkles,
  Terminal,
  type LucideIcon,
} from "lucide-react"

import { NavMain } from "@/components/dashboard/v3/nav-main"
import { NavSecondary } from "@/components/dashboard/v3/nav-secondary"
import { NavUser } from "@/components/dashboard/v3/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useRouter } from "next/navigation"

const NAV_MAIN = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: FileText },
  { title: "Mail", url: "/mail", icon: Inbox },
  { title: "Chat", url: "/chat", icon: MessageSquare },
  { title: "Todoist", url: "/todoist", icon: Sparkles },
  { title: "Knowledge", url: "/knowledge", icon: BookOpen },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Notion", url: "/notion", icon: Sparkles },
  { title: "Miro", url: "/miro", icon: Sparkles },
  { title: "Terminal", url: "/terminal", icon: Terminal },
]

const NAV_SECONDARY = [
  { title: "Useful Links", url: "/useful-links", icon: Send },
  { title: "Apps", url: "/apps", icon: Cable },
  { title: "Mailgo", url: "https://admin.tanim.tech", icon: Mail, external: true },
  { title: "Vault", url: "/vault", icon: FileText },
]

const SETTINGS_ITEMS = [
  { title: "General", url: "/settings" },
  { title: "Integrations", url: "/settings/integrations" },
  { title: "Mail", url: "/settings/mail" },
  { title: "Knowledge", url: "/settings/knowledge" },
]

export function AppSidebar({
  userEmail,
  ...props
}: React.ComponentProps<typeof Sidebar> & { userEmail: string }) {
  const router = useRouter()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={() => router.push("/")}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-foreground font-mono text-xs font-semibold text-background">
                SV
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">SlideIn Venture</span>
                <span className="truncate text-xs text-muted-foreground">Ops console</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain label="Main" items={NAV_MAIN} />
        <NavSecondary items={NAV_SECONDARY} />
        <NavMain
          label="Settings"
          items={[
            {
              title: "Settings",
              url: "/settings",
              icon: Settings,
              isActive: false,
              items: SETTINGS_ITEMS,
            },
          ]}
        />
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
    </Sidebar>
  )
}
