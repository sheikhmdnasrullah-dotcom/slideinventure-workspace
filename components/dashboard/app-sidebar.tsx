"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
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
import { NavUser } from "@/components/dashboard/v3/nav-user"

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

const NAV: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Mail", url: "/mail", icon: Inbox },
  { title: "Chat", url: "/chat", icon: MessageSquare },
  { title: "Todoist", url: "/todoist", icon: Sparkles },
  { title: "Knowledge", url: "/knowledge", icon: BookOpen },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Notion", url: "/notion", icon: Sparkles },
  { title: "Miro", url: "/miro", icon: Sparkles },
  { title: "Terminal", url: "/terminal", icon: Terminal },
  { title: "Useful Links", url: "/useful-links", icon: Send },
  { title: "Apps", url: "/apps", icon: Cable },
  { title: "Vault", url: "/vault", icon: FileText },
  { title: "Settings", url: "/settings", icon: Settings },
]

export function AppSidebar({
  userEmail,
  ...props
}: React.ComponentProps<typeof Sidebar> & { userEmail: string }) {
  const isActive = useIsActive()

  const navItems = NAV.map((item) => ({
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
        <nav>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton tooltip={item.title}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>
             </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </nav>
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